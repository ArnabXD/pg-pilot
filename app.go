package main

import (
	"context"

	"pg-pilot/pg"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx     context.Context
	quiting bool
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// beforeClose runs when the user clicks the window's close button. Unless
// quit was explicitly requested (via the tray menu), hide the window
// instead of exiting so managed Postgres instances keep running in the
// background.
func (a *App) beforeClose(ctx context.Context) bool {
	if a.quiting {
		return false
	}
	runtime.WindowHide(ctx)
	return true
}

// AvailableVersions returns the latest patch release for each curated
// Postgres major version, for the instance-creation version picker.
func (a *App) AvailableVersions() ([]string, error) {
	return pg.AvailableVersions()
}

// Status returns the live status of every registered instance.
func (a *App) Status() ([]pg.InstanceStatus, error) {
	return pg.Status()
}

// CreateInstance registers and initializes a new named Postgres instance,
// emitting "setup:progress" events with status text during download.
func (a *App) CreateInstance(name, version string, port int) error {
	return pg.CreateInstance(name, version, port, func(msg string) {
		runtime.EventsEmit(a.ctx, "setup:progress", msg)
	})
}

// DeleteInstance stops and permanently removes an instance.
func (a *App) DeleteInstance(name string) error {
	return pg.DeleteInstance(name)
}

// Start launches the named instance.
func (a *App) Start(name string) error {
	return pg.Start(name)
}

// Stop shuts down the named instance.
func (a *App) Stop(name string) error {
	return pg.Stop(name)
}

// ConnectionString returns the libpq URI for the named instance.
func (a *App) ConnectionString(name string) (string, error) {
	return pg.ConnectionString(name)
}

// Log returns the last n lines of the named instance's server log.
func (a *App) Log(name string, n int) (string, error) {
	return pg.Log(name, n)
}

// OpenDataDir reveals the named instance's data directory in the system
// file manager.
func (a *App) OpenDataDir(name string) {
	runtime.BrowserOpenURL(a.ctx, "file://"+pg.DataDir(name))
}
