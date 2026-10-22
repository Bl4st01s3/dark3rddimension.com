/**
 * This file is purely for reference and examples. It is not loaded by the website.
 * Use these examples as a template for adding new projects to `projects.js`.
 */

const projectDataExamples = {
  "workbench": [
    // EXAMPLE 1: Multi-line description and image folder with counts
    // This is the most complex setup. It requires backticks (`) for the description
    // if it spans multiple lines. It also uses `image_folder` and `counts` to automatically
    // load multiple images with different extensions (e.g. 1.jpg, 2.jpg, 1.png).
    {
      "id": "EX 01",
      "title": "Complex Project Example",
      "description": `This is a description that
spans multiple lines.

You MUST use backticks (\`) instead of normal quotes (" or ') to enclose this string,
otherwise the JavaScript will break and the page will be blank!`,
      "status": "LIVE",
      "image_folder": "assets/ComplexProject",
      "counts": {
        "jpg": 2, // This will look for 1.jpg and 2.jpg
        "png": 1  // This will look for 1.png
      },
      "link": "projects/complex-project.html"
    },

    // EXAMPLE 2: Single line description and simple images array
    // This is the simplest setup. If your description is just one line, you can use
    // standard double quotes ("). If you only have one or a few images, you can list
    // them directly in the `images` array.
    {
      "id": "EX 02",
      "title": "Simple Project Example",
      "description": "This is a simple single-line description.",
      "status": "IN PROGRESS",
      "images": [
        "assets/SimpleProject/main.jpg",
        "assets/SimpleProject/alt.png"
      ],
      "link": "projects/simple-project.html"
    },

    // EXAMPLE 3: No images
    // If a project doesn't have any images yet, you can omit the image properties.
    {
      "id": "EX 03",
      "title": "Text Only Project",
      "description": "This project has no images. The system will handle it gracefully.",
      "status": "STANDBY",
      "link": "projects/text-only.html"
    }
  ]
};
