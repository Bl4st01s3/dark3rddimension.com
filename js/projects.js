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
      "status": "TESTING",
      "image_folder": "assets/CyberSynk",
      "counts": {
        "jpg": 2,
        "png": 1
      },
      "link": "projects/cybersynk.html"
    },
    {
      "id": "NODE 02",
      "title": "CyberMouse",
      "description": `The CyberMouse gives hand gestures to non touch screen computer monitors by using a web cam connected to a Raspberry Pi 5.

The Case for the Pi 5 was originally [original Case URL] that has been extensively modified to contain the pi with the 26 TOPS 
version of the Raspberry Pi AI Hat+ and an auxiliary cooling to make sure that the CUP fan that is built into the heatsink is constantly
fed with cool outside ambient air. 

The CyberMouse will take the images (processing fames form the camera at 30 FPS) and then use custom trained
AI models to track your upper body, head and hands. It will then act as a mouse and trigger macros with hand gestures.

The system will also implement a lock stopping input if your not actively looking at the screen.

The CyberMouse main node is designed to handle one camera mounted on one screen but is expandable with sub nodes running on Raspberry Pi Zero 2ws
that have there own cameras mounted to other monitors in a multi monitor set up that then send the video stream to the main node for processing 
letting the CyberMouse work with bigger multi monitor setups`,
      "status": "CODING",
      "image_folder": "assets/project_alpha",
      "counts": {
        "jpg": 0,
        "png": 2
      },
      "link": "projects/cybermouse.html"
    },
    {
      "id": "NODE 03",
      "title": "NOVA",
      "description": `NOVA is a AI personal Assistant that uses Python Script Tools to interact with the System and the World meaning that it is safer to let loose on your whole system because each tool has built in safety nets meaning that even if the AI hallucinates the Tool Scripts wont let anything catastrophic happen.

Under the hood NOVA is Based on 2 Models a Decision Model and a Conversation model, both of witch are small 3B models. the Decision Model Decides what tools if any are required to be run and the conversation Model is for phrasing a response if a tool is used it is spoon fed the information to use in the response.

The System Use LMStudio witch means that Bionic will need to be installed for the System to work.

the System Tools act like plugins meaning that you can write your own tools and by having the tool script along with any other files that the tool needs to run in a directory that in the name of the tool and placing that directory in the tools directory meaning that users can make and add there own tools giving nova a completely custom and unique set of abelites that suit the users needs.

Nova Will never run direct System commands instead only interreacting with the system through these tools meaning that the tools can have built in safety nets with the idea being that if the AI Hallucinates and tries to do something that could be catastrophic to projects or the system then the Tools themselves will refuse to run.`,
      "status": "EXPANSION",
      "images": ["assets/placeholder5.jpg"],
      "link": "projects/nova.html"
    }
  ],
  "archive": [
    {
      "id": "ARCH 01",
      "title": "CyberWeb",
      "description": `The CyberWeb is Software Designed for taking notes in a manner that doesn't have you facing a wall of text.

It dose this by laying the notes out on a spider web diagram and letting you view the notes as you explore through the diagram letting you only see the notes on a specific part of the project.

Each header of the Diagram can be set to be a colour and shape letting you code your notes throughout the diagram to make the relevant part easy to find.

The idea of this project lets people make and read there notes without being faced with a big wall of text that can be difficult for Dyslectics and those with ADHD by letting you focus on one and only see one small part of the notes at a time.`,
      "status": "ARCHIVED",
      "images": ["assets/placeholder1.jpg"],
      "link": "projects/cyberweb.html"
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
