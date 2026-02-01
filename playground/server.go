package main

import (
	"fmt"
	"net/http"

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
			"three": "../include/three@0.182.0/three.js",
			"three/webgpu": "../include/three@0.182.0/webgpu.js",
			"three/tsl": "../include/three@0.182.0/tsl.js",
			"three/examples/jsm": "../include/three@0.182.0/examples/jsm",
		},
	}

	clientCtx, err := esbuild.Context(options)

	if err != nil {
		panic(err)
	}

	mux := http.NewServeMux()

	mux.HandleFunc("GET /", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Add("Content-Type", "text/html")
		w.Write(shell)
	})

	mux.HandleFunc("GET /main.js", func(w http.ResponseWriter, r *http.Request) {
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

var shell = []byte(`
<!DOCTYPE html>
<html>
	<head>
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<title>Hello!</title>
		<script type="module" src="/main.js"></script>
	</head>
  	<body></body>
</html>
`)
