# gist-in

This *gist-in* package provides:

1.  An exportable module that JS-based web servers and JS-based build tools can use to embed a github based gist of html (and js, css, json phase II) into an html stream for optimal performance, as long as the gist responds in a timely manner. [Phase II]
2.  A fallback element enhancement similar to [pipe-in](https://github.com/bahrus/pipe-in) to request the gist resource in the browser client, and to patch the HTML with the delayed content.

Note that github's gists play very nicely from a CORS point of view, so rest assured that should not impose any browser issues.

We make heavy use of [declarative partial updates](https://developer.chrome.com/docs/web-platform/declarative-partial-updates), both in spirit and in use of upcoming api's.

```html
<select>
<?marker name="options">
</select>



...

<!-- bottom of the page, typically -->

<template gist-in="https://gist.githubusercontent.com/bahrus/3c9ed8541984b8cd38bc848edacf741a/raw/90e8c7ebfa3f63948f380d44d40b2663d19919e2/test.html" gist-in-for="options"></template>
```

<?start> and <?end> markers would also be supported.

## Why comment markers?

1.  Only the template and script elements can be placed anywhere in the DOM without violating HTML decorum and/or having unexpected side effects, and using these elements (template, script) as place holders isn't really semantic.
2.  It aligns with how the platform envisions partially updating pages, as the link above indicates.  Hopefully, perhaps, in the future, the platform will provide easier API hooks to find such things, since it needs such abilities to implement its own requirements.
3.  This enhancement is designed to lean on the platform where it can based on the newly minted syntax.

Searching for such markers can be rather taxing, requiring perhaps a TreeWalker (or xpath), so a helper optimizer attribute should be supported that allows for a css query, that is expected to point to the parent of the marker(s):

```html
<select>
<?marker name="options">
</select>


<template gist-in="https://gist.githubusercontent.com/bahrus/3c9ed8541984b8cd38bc848edacf741a/raw/90e8c7ebfa3f63948f380d44d40b2663d19919e2/test.html" gist-in-for="options" gist-in-for-hint="body select"></template>
```


I'm thinking the template could be removed after serving its purpose.

For now, this would always apply the standard, []"safe" sanitizing that pipe-in defaults to](https://github.com/bahrus/pipe-in#security).

Searching is done within the element.getElementRoot(), so templates inside shadow Roots would only replace markers inside the shadow root.


## Editing Support

If either an edit attribute is present:


```html
<template gist-in="https://gist.githubusercontent.com/bahrus/3c9ed8541984b8cd38bc848edacf741a/raw/90e8c7ebfa3f63948f380d44d40b2663d19919e2/test.html" gist-in-for="options" gist-in-show-edit-link></template>
```

Or a query string:

location.href = '...?gist-in-show-edit-link=true'

Then add a hyperlink right after the template that allows the user (with appropriate credentials, as guarded by github.com itself) to open the gist and make edits.

If phase II is implemented, the server would replace the template above with something like:

```html
<template gist-in-resolved="https://gist.githubusercontent.com/bahrus/3c9ed8541984b8cd38bc848edacf741a/raw/90e8c7ebfa3f63948f380d44d40b2663d19919e2/test.html" for="options" gist-in-show-edit-link>
    ...the contents of the link
</template>
<a href="urlToEditGist">Edit test.html</a>
```

But that will be worked out in more detail later.


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