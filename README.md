# awm-internal-pages

This repository hosts individual HTML pages within folders so they can be viewed directly.

## Structure

- `index.html` - landing page with links to available pages
- `pages/<page-name>/index.html` - each page lives in its own folder

## Add a new page

1. Create a folder: `pages/<your-page-name>/`
2. Add an `index.html` file inside that folder.
3. Add a link to the new folder in root `index.html`.

## Rent vs Buy: saving scenarios

The Rent vs Buy page can save a set of inputs and load it again later:

- **Save in this browser** keeps a named scenario in the browser's local storage on that device.
- **Save to file** downloads the inputs as a JSON file. **Load from file** reads one back.

Scenario files hold client figures. Keep them out of this repository.
