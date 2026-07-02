// Package pg manages portable, no-install PostgreSQL instances: download,
// initdb, start, stop, multiple named instances. Binaries come from zonky's
// embedded-postgres-binaries (Maven Central), which package official EDB
// builds as a jar containing one .txz per platform. No package manager, no
// root required.
package pg

import (
	"archive/tar"
	"archive/zip"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strconv"
	"strings"

	"github.com/ulikunitz/xz"
)

// curatedMajors are the Postgres major versions offered in the version
// picker. Update this list as majors go EOL / new ones ship.
var curatedMajors = []string{"18", "17", "16", "15", "14"}

// AvailableVersions fetches the latest patch release for each curated major
// version from Maven Central. Requires network; done in Go rather than the
// frontend because Maven Central doesn't send CORS headers.
func AvailableVersions() ([]string, error) {
	plat, err := platformSuffix()
	if err != nil {
		return nil, err
	}
	url := fmt.Sprintf(
		"https://repo1.maven.org/maven2/io/zonky/test/postgres/embedded-postgres-binaries-%s/maven-metadata.xml",
		plat,
	)
	resp, err := http.Get(url)
	if err != nil {
		return nil, fmt.Errorf("fetch version list: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("fetch version list: unexpected status %s", resp.Status)
	}

	var meta struct {
		Versioning struct {
			Versions []string `xml:"versions>version"`
		} `xml:"versioning"`
	}
	if err := xml.NewDecoder(resp.Body).Decode(&meta); err != nil {
		return nil, fmt.Errorf("parse version list: %w", err)
	}

	latest := map[string]string{}
	for _, v := range meta.Versioning.Versions {
		major, _, ok := strings.Cut(v, ".")
		if !ok {
			continue
		}
		latest[major] = v // versions are listed oldest-first, so last write wins
	}

	var result []string
	for _, major := range curatedMajors {
		if v, ok := latest[major]; ok {
			result = append(result, v)
		}
	}
	return result, nil
}

func platformSuffix() (string, error) {
	switch runtime.GOOS {
	case "linux":
		switch runtime.GOARCH {
		case "amd64":
			return "linux-amd64", nil
		case "arm64":
			return "linux-arm64v8", nil
		}
	case "windows":
		if runtime.GOARCH == "amd64" {
			return "windows-amd64", nil
		}
	}
	return "", fmt.Errorf("unsupported platform: %s/%s", runtime.GOOS, runtime.GOARCH)
}

var baseDir = func() string {
	dir, err := os.UserHomeDir()
	if err != nil {
		dir = os.TempDir()
	}
	return filepath.Join(dir, ".local", "share", "pg-pilot")
}()

// Instance is one named, independently managed Postgres server.
type Instance struct {
	Name    string `json:"name"`
	Version string `json:"version"` // full zonky version, e.g. "17.10.0"
	Port    int    `json:"port"`
}

func registryPath() string             { return filepath.Join(baseDir, "instances.json") }
func versionDir(version string) string { return filepath.Join(baseDir, "versions", version) }
func binDir(version string) string     { return filepath.Join(versionDir(version), "bin") }
func instanceDir(name string) string   { return filepath.Join(baseDir, "instances", name) }
func dataDir(name string) string       { return filepath.Join(instanceDir(name), "data") }
func logPath(name string) string       { return filepath.Join(instanceDir(name), "server.log") }

var nameRe = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$`)

func loadRegistry() ([]Instance, error) {
	data, err := os.ReadFile(registryPath())
	if os.IsNotExist(err) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var instances []Instance
	if err := json.Unmarshal(data, &instances); err != nil {
		return nil, err
	}
	return instances, nil
}

func saveRegistry(instances []Instance) error {
	if err := os.MkdirAll(baseDir, 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(instances, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(registryPath(), data, 0o644)
}

func findInstance(instances []Instance, name string) (Instance, bool) {
	for _, inst := range instances {
		if inst.Name == name {
			return inst, true
		}
	}
	return Instance{}, false
}

// ListInstances returns all registered instances.
func ListInstances() ([]Instance, error) {
	return loadRegistry()
}

func binaryURL(version string) (string, error) {
	plat, err := platformSuffix()
	if err != nil {
		return "", err
	}
	return fmt.Sprintf(
		"https://repo1.maven.org/maven2/io/zonky/test/postgres/embedded-postgres-binaries-%s/%s/embedded-postgres-binaries-%s-%s.jar",
		plat, version, plat, version,
	), nil
}

func versionInstalled(version string) bool {
	initdb := "initdb"
	if runtime.GOOS == "windows" {
		initdb = "initdb.exe"
	}
	_, err := os.Stat(filepath.Join(binDir(version), initdb))
	return err == nil
}

// InstalledVersion is a locally downloaded Postgres version, plus whether
// any registered instance currently depends on it.
type InstalledVersion struct {
	Version string `json:"version"`
	Bytes   int64  `json:"bytes"`
	InUse   bool   `json:"inUse"`
}

// InstalledVersions lists Postgres versions downloaded to disk.
func InstalledVersions() ([]InstalledVersion, error) {
	entries, err := os.ReadDir(filepath.Join(baseDir, "versions"))
	if os.IsNotExist(err) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	instances, err := loadRegistry()
	if err != nil {
		return nil, err
	}
	inUse := map[string]bool{}
	for _, inst := range instances {
		inUse[inst.Version] = true
	}

	var out []InstalledVersion
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		size, err := dirSize(versionDir(e.Name()))
		if err != nil {
			return nil, err
		}
		out = append(out, InstalledVersion{Version: e.Name(), Bytes: size, InUse: inUse[e.Name()]})
	}
	return out, nil
}

func dirSize(path string) (int64, error) {
	var total int64
	err := filepath.WalkDir(path, func(_ string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		info, err := d.Info()
		if err != nil {
			return err
		}
		total += info.Size()
		return nil
	})
	return total, err
}

// DeleteVersion removes a downloaded Postgres version's files. Refuses if
// any registered instance still uses it.
func DeleteVersion(version string) error {
	instances, err := loadRegistry()
	if err != nil {
		return err
	}
	for _, inst := range instances {
		if inst.Version == version {
			return fmt.Errorf("version %q is used by instance %q", version, inst.Name)
		}
	}
	if !versionInstalled(version) {
		return fmt.Errorf("version %q is not installed", version)
	}
	return os.RemoveAll(versionDir(version))
}

// downloadVersion fetches and unpacks a Postgres version if not already
// present locally. Shared across instances that use the same version.
func downloadVersion(version string, progress func(string)) error {
	if versionInstalled(version) {
		return nil
	}

	url, err := binaryURL(version)
	if err != nil {
		return err
	}

	progress("downloading postgres " + version)
	tmp, err := os.CreateTemp("", "pg-pilot-*.jar")
	if err != nil {
		return err
	}
	defer os.Remove(tmp.Name())
	defer tmp.Close()

	resp, err := http.Get(url)
	if err != nil {
		return fmt.Errorf("download: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("download: unexpected status %s", resp.Status)
	}
	if _, err := io.Copy(tmp, resp.Body); err != nil {
		return fmt.Errorf("download: %w", err)
	}

	progress("unpacking")
	if err := os.MkdirAll(versionDir(version), 0o755); err != nil {
		return err
	}
	return unpackJar(tmp.Name(), versionDir(version))
}

// unpackJar extracts the single .txz entry from a zonky binaries jar
// (a zip file) into dest.
func unpackJar(jarPath, dest string) error {
	zr, err := zip.OpenReader(jarPath)
	if err != nil {
		return err
	}
	defer zr.Close()

	for _, f := range zr.File {
		if filepath.Ext(f.Name) != ".txz" {
			continue
		}
		rc, err := f.Open()
		if err != nil {
			return err
		}
		defer rc.Close()

		xr, err := xz.NewReader(rc)
		if err != nil {
			return err
		}
		return untar(xr, dest)
	}
	return fmt.Errorf("no .txz entry found in %s", jarPath)
}

func untar(r io.Reader, dest string) error {
	tr := tar.NewReader(r)
	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			return nil
		}
		if err != nil {
			return err
		}
		target := filepath.Join(dest, hdr.Name)
		switch hdr.Typeflag {
		case tar.TypeDir:
			if err := os.MkdirAll(target, 0o755); err != nil {
				return err
			}
		case tar.TypeReg:
			if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
				return err
			}
			out, err := os.OpenFile(target, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, os.FileMode(hdr.Mode))
			if err != nil {
				return err
			}
			if _, err := io.Copy(out, tr); err != nil {
				out.Close()
				return err
			}
			out.Close()
		case tar.TypeSymlink:
			_ = os.Symlink(hdr.Linkname, target)
		}
	}
}

func bin(version, name string) string {
	if runtime.GOOS == "windows" {
		name += ".exe"
	}
	return filepath.Join(binDir(version), name)
}

func initialized(name string) bool {
	_, err := os.Stat(filepath.Join(dataDir(name), "PG_VERSION"))
	return err == nil
}

func initdb(name, version string) error {
	if err := os.MkdirAll(dataDir(name), 0o700); err != nil {
		return err
	}
	cmd := exec.Command(bin(version, "initdb"),
		"-D", dataDir(name),
		"-U", "postgres",
		"--auth=trust",
		"--no-instructions",
	)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("initdb: %w: %s", err, out)
	}
	return nil
}

// CreateInstance registers a new instance, downloading its Postgres version
// if needed and running initdb. progress receives human-readable status
// lines for the UI.
func CreateInstance(name, version string, port int, progress func(string)) error {
	if !nameRe.MatchString(name) {
		return fmt.Errorf("invalid name %q: use letters, digits, - or _, starting with a letter or digit", name)
	}
	if port < 1 || port > 65535 {
		return fmt.Errorf("invalid port: %d", port)
	}

	instances, err := loadRegistry()
	if err != nil {
		return err
	}
	if _, exists := findInstance(instances, name); exists {
		return fmt.Errorf("instance %q already exists", name)
	}
	for _, inst := range instances {
		if inst.Port == port {
			return fmt.Errorf("port %d already used by instance %q", port, inst.Name)
		}
	}

	if err := downloadVersion(version, progress); err != nil {
		return err
	}

	progress("initializing database")
	if err := initdb(name, version); err != nil {
		return err
	}

	instances = append(instances, Instance{Name: name, Version: version, Port: port})
	return saveRegistry(instances)
}

// DeleteInstance stops (if running) and removes an instance's data
// directory and registry entry. Downloaded Postgres binaries for its
// version are left in place in case other instances use them.
func DeleteInstance(name string) error {
	instances, err := loadRegistry()
	if err != nil {
		return err
	}
	inst, exists := findInstance(instances, name)
	if !exists {
		return fmt.Errorf("instance %q not found", name)
	}

	if isRunning(name, inst.Version) {
		if err := Stop(name); err != nil {
			return err
		}
	}
	if err := os.RemoveAll(instanceDir(name)); err != nil {
		return err
	}

	kept := instances[:0]
	for _, i := range instances {
		if i.Name != name {
			kept = append(kept, i)
		}
	}
	return saveRegistry(kept)
}

// Start launches the named instance's Postgres server in the background,
// if it isn't already running.
func Start(name string) error {
	instances, err := loadRegistry()
	if err != nil {
		return err
	}
	inst, exists := findInstance(instances, name)
	if !exists {
		return fmt.Errorf("instance %q not found", name)
	}
	if isRunning(name, inst.Version) {
		return nil
	}
	if !initialized(name) {
		return fmt.Errorf("instance %q is not initialized", name)
	}
	cmd := exec.Command(bin(inst.Version, "pg_ctl"),
		"-D", dataDir(name),
		"-l", logPath(name),
		"-o", fmt.Sprintf("-p %d", inst.Port),
		"start",
	)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("pg_ctl start: %w: %s", err, out)
	}
	return nil
}

// Stop shuts down the named instance's server gracefully.
func Stop(name string) error {
	instances, err := loadRegistry()
	if err != nil {
		return err
	}
	inst, exists := findInstance(instances, name)
	if !exists {
		return fmt.Errorf("instance %q not found", name)
	}
	if !isRunning(name, inst.Version) {
		return nil
	}
	cmd := exec.Command(bin(inst.Version, "pg_ctl"), "-D", dataDir(name), "stop", "-m", "fast")
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("pg_ctl stop: %w: %s", err, out)
	}
	return nil
}

// isRunning checks server status via pg_ctl (reads the postmaster.pid file).
func isRunning(name, version string) bool {
	cmd := exec.Command(bin(version, "pg_ctl"), "-D", dataDir(name), "status")
	return cmd.Run() == nil
}

// InstanceStatus is an instance's registry data plus its live run state.
type InstanceStatus struct {
	Name    string `json:"name"`
	Version string `json:"version"`
	Port    int    `json:"port"`
	Running bool   `json:"running"`
	DataDir string `json:"dataDir"`
}

// Status returns the live status of every registered instance.
func Status() ([]InstanceStatus, error) {
	instances, err := loadRegistry()
	if err != nil {
		return nil, err
	}
	statuses := make([]InstanceStatus, 0, len(instances))
	for _, inst := range instances {
		statuses = append(statuses, InstanceStatus{
			Name:    inst.Name,
			Version: inst.Version,
			Port:    inst.Port,
			Running: isRunning(inst.Name, inst.Version),
			DataDir: dataDir(inst.Name),
		})
	}
	return statuses, nil
}

// ConnectionString returns a libpq URI for the named instance's trust-auth
// postgres superuser.
func ConnectionString(name string) (string, error) {
	instances, err := loadRegistry()
	if err != nil {
		return "", err
	}
	inst, exists := findInstance(instances, name)
	if !exists {
		return "", fmt.Errorf("instance %q not found", name)
	}
	return "postgresql://postgres@localhost:" + strconv.Itoa(inst.Port) + "/postgres", nil
}

// DataDir returns the path to the named instance's data directory, for
// opening in a file manager.
func DataDir(name string) string { return dataDir(name) }

// Log returns the last n lines of the named instance's server log.
func Log(name string, n int) (string, error) {
	data, err := os.ReadFile(logPath(name))
	if err != nil {
		if os.IsNotExist(err) {
			return "", nil
		}
		return "", err
	}
	lines := strings.Split(strings.TrimRight(string(data), "\n"), "\n")
	if len(lines) > n {
		lines = lines[len(lines)-n:]
	}
	return strings.Join(lines, "\n"), nil
}
