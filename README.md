# gist-in

This *gist-in* package provides:

1.  An exportable module that JS-based web servers and JS-based build tools can use to embed a github based gist of html (and js, css, json phase II) into an html stream for optimal performance, as long as the gist responds in a timely manner.
2.  A fallback element enhancement to request the gist resource in the browser client, and to patch the HTML with the delayed content.

For the ideal scenario, we make heavy use of [declarative partial updates](https://developer.chrome.com/docs/web-platform/declarative-partial-updates).

```html
<select>
<?marker name="options">
</select>


<template gist-in="https://gist.githubusercontent.com/bahrus/3c9ed8541984b8cd38bc848edacf741a/raw/90e8c7ebfa3f63948f380d44d40b2663d19919e2/test.html" gist-for=""></template>
```

## Viewing Locally

Any web server that serves static files with server-side includes will do but...

1. Install git
2. Fork/clone this repo
3. Install node.js
4. Open command window to folder where you cloned this repo
5. > git submodule add https://github.com/bahrus/types.git types
6. > git submodule update --init --recursive
7. > npm install
8. > npm run build
9. > npm run serve
10. Open http://localhost:8000/demo/ in a modern browser (Chrome 146+ — JSON module imports with type assertion are required)

## Running Tests

```
> npm run test
```