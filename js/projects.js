const projectData = {
  "workbench": [
    {
      "id": "NODE 01",
      "title": "CyberSynk",
      "description": `The CyberSynk Command Console is an all in one console to control your entire desk set up, Multiple PCs, WLED, 3D printers (Klipper, Bambu, Prusa and Octoprint).

It is designed to have physical hardware mounted to the wings that flank the 10 inch screen to give options for physical buttons, rotary encoders, pots, and sliders letting the user build the system to there needs.

The System uses a page system for its buttons on the screen giving a practically unlimited number of buttons to configure

Each button has an easy to configure event chain that can be configured to make them perform macros and can be set to be momentary, or latching loop

Each button can also have either a built in image, OR you can upload your own SVGs, SVGs are used so that the colours can be changed on a per button bases AND can also change colour to indicate button states 
along with the colour of the text and button border

The way that the System is set up means that Adding your own Python scripts to expand the Systems abilities is as easy as writing the script following the instructions in the in PROTOCOLS/ACTIONS_PROTOCOL.md 
and dropping it into the right file in directory that is named the name of the tool will any other files that It needs to run.`,
      "status": "LIVE",
      "image_folder": "assets/CyberSynk",
      "counts": {
        "jpg": 2,
        "png": 1
      },
      "link": "projects/site-chassis.html"
    },
    {
      "id": "NODE 02",
      "title": "Project Alpha",
      "description": "Reserved slot for the project currently on the bench.",
      "status": "STANDBY",
      "image_folder": "assets/project_alpha",
      "counts": {
        "jpg": 2,
        "png": 1
      },
      "link": "projects/alpha.html"
    },
    {
      "id": "NODE 03",
      "title": "Data stream",
      "description": "Real-time feed integration for the main viewscreen.",
      "status": "IN PROGRESS",
      "images": ["assets/placeholder5.jpg"],
      "link": "projects/data-stream.html"
    }
  ],
  "archive": [
    {
      "id": "ARCH 01",
      "title": "Legacy System",
      "description": "Previous iteration of the Skunkworks interface.",
      "status": "ARCHIVED",
      "images": ["assets/placeholder1.jpg"],
      "link": "projects/legacy.html"
    }
  ],
  "background_threads": [
    {
      "id": "THRD 01",
      "title": "AI Neural Net",
      "description": "Experimental generative models for local deployment.",
      "status": "SUSPENDED",
      "images": ["assets/placeholder2.jpg", "assets/placeholder5.jpg"],
      "link": "projects/neural-net.html"
    }
  ]
};
