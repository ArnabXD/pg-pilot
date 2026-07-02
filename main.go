package main

import (
	"embed"

	"fyne.io/systray"
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

//go:embed all:frontend/dist
var assets embed.FS

//go:embed build/tray/icon.png
var trayIcon []byte

func main() {
	app := NewApp()

	go systray.Run(func() {
		systray.SetIcon(trayIcon)
		systray.SetTooltip("pg-pilot")

		show := systray.AddMenuItem("Show pg-pilot", "Show the main window")
		systray.AddSeparator()
		quit := systray.AddMenuItem("Quit", "Stop pg-pilot")

		go func() {
			for {
				select {
				case <-show.ClickedCh:
					runtime.WindowShow(app.ctx)
				case <-quit.ClickedCh:
					app.quiting = true
					runtime.Quit(app.ctx)
					return
				}
			}
		}()
	}, func() {})

	err := wails.Run(&options.App{
		Title:  "pg-pilot",
		Width:  1024,
		Height: 768,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		EnableDefaultContextMenu: false,
		BackgroundColour:         &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup:                app.startup,
		OnBeforeClose:            app.beforeClose,
		Bind: []interface{}{
			app,
		},
	})

	systray.Quit()

	if err != nil {
		println("Error:", err.Error())
	}
}
