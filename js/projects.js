const projectData = {
  "workbench": [
    {
      "id": "NODE 01",
      "title": "CyberSynk",
      "description": `The CyberSynk Command Console is an all-in-one console to control your entire desk setup, multiple PCs, WLED, and 3D printers (Klipper, Bambu, Prusa, and OctoPrint).

It is designed to have physical hardware mounted to the wings that flank the 10-inch screen to give options for physical buttons, rotary encoders, pots, and sliders, letting the user build the system to their needs.

The system uses a page system for its buttons on the screen, giving a practically unlimited number of buttons to configure.

Each button has an easy-to-configure event chain that can be configured to make them perform macros and can be set to be momentary or a latching loop.

Each button can also have either a built-in image, OR you can upload your own SVGs. SVGs are used so that the colours can be changed on a per-button basis AND can also change colour to indicate button states, along with the colour of the text and button border.

The way that the system is set up means that adding your own Python scripts to expand the system's abilities is as easy as writing the script following the instructions in PROTOCOLS/ACTIONS_PROTOCOL.md and dropping it into the right directory named after the tool, along with any other files that it needs to run.`,
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
      "description": `The CyberMouse gives hand-gesture control to non-touchscreen computer monitors by using a webcam connected to a Raspberry Pi 5.

The case for the Pi 5 was originally [original Case URL] and has been extensively modified to contain the Pi with the 26 TOPS version of the Raspberry Pi AI HAT+ and auxiliary cooling to make sure that the CPU fan built into the heatsink is constantly fed with cool outside ambient air.

The CyberMouse takes the images (processing frames from the camera at 30 FPS) and then uses custom-trained AI models to track your upper body, head, and hands. It will then act as a mouse and trigger macros with hand gestures.

The system will also implement a lock, stopping input if you're not actively looking at the screen.

The CyberMouse main node is designed to handle one camera mounted on one screen, but is expandable with sub-nodes running on Raspberry Pi Zero 2 Ws that have their own cameras mounted to other monitors in a multi-monitor setup, which then send the video stream to the main node for processing—letting the CyberMouse work with bigger multi-monitor setups.`,
      "status": "CODING",
      "image_folder": "assets/CyberMouse",
      "counts": {
        "jpg": 0,
        "png": 2
      },
      "link": "projects/cybermouse.html"
    },
    {
      "id": "NODE 03",
      "title": "NOVA",
      "description": `NOVA is an AI personal assistant that uses Python script tools to interact with the system and the world, meaning that it is safer to let loose on your whole system because each tool has built-in safety nets—so even if the AI hallucinates, the tool scripts won't let anything catastrophic happen.

Under the hood, NOVA is based on 2 models: a Decision Model and a Conversation Model, both of which are small 3B models. The Decision Model decides what tools, if any, are required to be run, and the Conversation Model is for phrasing a response. If a tool is used, it is spoon-fed the information to use in the response.

The system uses LM Studio, which means that Bionic will need to be installed for the system to work.

The system tools act like plugins, meaning that you can write your own tools by having the tool script along with any other files that the tool needs to run in a directory named after the tool and placing that directory in the tools directory—meaning that users can make and add their own tools, giving NOVA a completely custom and unique set of abilities that suit the user's needs.

NOVA will never run direct system commands, instead only interacting with the system through these tools, meaning that the tools can have built-in safety nets—with the idea being that if the AI hallucinates and tries to do something that could be catastrophic to projects or the system, then the tools themselves will refuse to run.`,
      "status": "EXPANSION",
      "image_folder": "assets/Nova",
      "counts": {
        "jpg": 0,
        "png": 2
      },
      "link": "projects/nova.html"
    }
  ],
  "archive": [
    {
      "id": "ARCH 01",
      "title": "CyberWeb",
      "description": `The CyberWeb is software designed for taking notes in a manner that doesn't have you facing a wall of text.

It does this by laying the notes out on a spider-web diagram and letting you view the notes as you explore through the diagram, letting you only see the notes on a specific part of the project.

Each header of the diagram can be set to a colour and shape, letting you colour-code your notes throughout the diagram to make the relevant part easy to find.

The idea of this project lets people make and read their notes without being faced with a big wall of text that can be difficult for people with dyslexia and those with ADHD, by letting you focus on and only see one small part of the notes at a time.`,
      "status": "ARCHIVED",
      "images": ["assets/placeholder1.jpg"],
      "link": "projects/cyberweb.html"
    },
    {
      "id": "ARCH 02",
      "title": "Grills Just Wanna Have Fun",
      "description": `The 'Grills Just Wanna Have Fun' StealthBurner Mod puts a hexagonal pattern grill over both the heatbreak fan and part cooling fan.

It was made to prevent things from getting into a moving fan, from stringing on a print with wet filament to small children's fingers or pets (which shouldn't really happen with an on and working 3D printer, but I'd rather have that guaranteed).

I have been running this design for over a year on my Voron V2.4 350 (as seen in the picture), and I've had to pull a few clumps of balled-up, stringy bits of filament out of the grill—but it's better they were in the grill where I can easily access them than getting sucked into the fan and either getting to the heatbreak or getting wrapped around the spindle.

The base of this mod was the standard, unmodded Voron StealthBurner straight from the Voron GitHub repo, and all I did was add the grill, so the installation is exactly the same.`,
      "status": "ARCHIVED",
      "image_folder": "assets/Grill_Just_Wanna_Have_Fun",
      "counts": {
        "jpg": 2,
        "png": 0
      },
      "link": "projects/grills_just_wanna_have_fun_stealthburner_mod.html"
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
