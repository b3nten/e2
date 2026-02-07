// SPDX-License-Identifier: AGPL-3.0-or-later

/*_,.-'~'-.,__,.-'~'-.,__,.-'~'-.,__,.-'~'-.,__,.-'~'-.,__,.-'~'-.,__,.-'~'-.,_

Copyright (C) 2026 Benton Boychuk-Chorney

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published
by the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.

_,.-'~'-.,__,.-'~'-.,__,.-'~'-.,__,.-'~'-.,__,.-'~'-.,__,.-'~'-.,__,.-'~'-.,_*/

package main

import (
	"fmt"
	"net/http"
	"os"

	esbuild "github.com/evanw/esbuild/pkg/api"
)

func main() {
	options := esbuild.BuildOptions{
		EntryPoints: []string{"main.ts"},
		Bundle:      true,
		Write:       false,
		Target:      esbuild.ES2022,
		Format:      esbuild.FormatESModule,
		Metafile:    false,
		Splitting:   false,
		Loader:      map[string]esbuild.Loader{},
		Plugins:     []esbuild.Plugin{},
		Alias: map[string]string{
			"three":              "../include/three@0.182.0/three.js",
			"three/webgpu":       "../include/three@0.182.0/webgpu.js",
			"three/tsl":          "../include/three@0.182.0/tsl.js",
			"three/examples/jsm": "../include/three@0.182.0/examples/jsm",
		},
	}

	clientCtx, err := esbuild.Context(options)

	if err != nil {
		panic(err)
	}

	mux := http.NewServeMux()

	mux.Handle("GET /assets/", http.StripPrefix("/assets/", http.FileServer(http.Dir("assets"))))

	writeError := func(w http.ResponseWriter, message string) {
		w.Header().Add("Content-Type", "text/html")
		w.Write([]byte("<h1>500 Internal Server Error</h1><p>" + message + "</p>"))
	}

	mux.HandleFunc("GET /", func(w http.ResponseWriter, r *http.Request) {
		index, err := os.OpenFile("index.html", os.O_RDONLY, 0644)
		if err != nil {
			writeError(w, "Failed to open index.html")
			return
		}
		defer index.Close()
		w.Header().Add("Content-Type", "text/html")
		_, err = index.WriteTo(w)
		if err != nil {
			writeError(w, "Failed to read index.html")
			return
		}
	})

	mux.HandleFunc("GET /main.ts", func(w http.ResponseWriter, r *http.Request) {
		result := clientCtx.Rebuild()
		if len(result.Errors) > 0 {
			w.Header().Add("Content-Type", "application/javascript")
			for _, value := range result.Errors {
				fmt.Println("esbuild:", value.Text)
				w.Write([]byte("console.error('esbuild:', `" + value.Text + "`);"))
			}
			return
		}
		w.Header().Add("Content-Type", "application/javascript")
		w.Write(result.OutputFiles[0].Contents)
	})

	http.ListenAndServe(":8000", mux)
}
