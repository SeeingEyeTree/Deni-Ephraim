/* Edit this file to change what is on the tree. No build step needed.
 *
 * The tree has 10 project branches, one per entry below, in order.
 *
 *   A branch with   stub: true   is a plain, unlit branch with no label.
 *   To light it up: fill in the entry and delete the  stub: true  line.
 *   To park a project again: add  stub: true  back. Nothing else moves.
 *
 *   title    full name, shown in the panel and the list
 *   short    1-2 words for the label on the glowing branch (defaults to title)
 *   status   optional small heading, e.g. "In progress", "Shipped"
 *   year     optional
 *   summary  one or two sentences, shown large
 *   body     optional array of extra paragraphs
 *   facts    optional array of { label, value } rows
 *   tags     optional array of short strings
 *   links    optional array of { label, url } - repo, video, live site...
 *   leaf     optional; what hangs at the branch tip and is shown when you zoom in:
 *              leaf: { image: "assets/picture.png", size: 1.2 }      a picture (PNG, JPG, WebP, SVG)
 *              leaf: { model: "assets/thing.glb", size: 1.2, spin: true, turn: 0 }   a 3D model (.glb)
 *            Put the file in the assets folder. size is in metres (the tree is about 7 tall);
 *            turn rotates a model, in degrees, if it faces the wrong way. Leave leaf out for the glowing leaf.
 *   slug     optional; the address becomes yoursite/#slug (letters, digits, hyphens)
 */
window.TREE_SITE = {
  title: "I am Tree",
  tagline: "Things I am growing. Pick a glowing branch.",
  projects: [
    {
      title: "Dennis Ephraim",
      short: "About me",
      slug: "about",
      status: "About me",
      leaf: { image: "assets/pitt-seal.png", size: 1 },
      summary: "Computer Engineering student at the University of Pittsburgh, working on robotics software, embedded systems and reinforcement learning.",
      body: [
        "I like building things that can be tested properly: path planning in ROS2, small reinforcement-learning agents, and most recently a large game-AI codebase built with AI coding agents, with a focus on clean architecture and rigorous verification.",
        "Before that I spent two years on the software and controls team at Pittsburgh Electric Propulsion, turning GPS and other sensor data into one frame of reference for an autonomous boat, and a year as an undergraduate teaching assistant for Physics 1.",
        "I am looking for a new-grad role working with Python, C++ and robotics software."
      ],
      facts: [
        { label: "Studying", value: "B.S. Computer Engineering, University of Pittsburgh (Swanson School of Engineering), expected May 2027. Dean's Honor List." },
        { label: "Languages", value: "Python, C++, C, C#, Lua, JavaScript, MATLAB" },
        { label: "Tools", value: "ROS2 Humble, OpenCV, TensorFlow, Gymnasium, Git, Claude Code, Arduino, CAD" },
        { label: "Interests", value: "Path planning, reinforcement learning, software architecture, test design and simulation" }
      ],
      links: [
        { label: "GitHub", url: "https://github.com/SeeingEyeTree" },
        { label: "LinkedIn", url: "https://www.linkedin.com/in/dennis-malcolm-ephraim-a73588282" }
      ]
    },
    {
      title: "MetalBot",
      short: "MetalBot",
      slug: "metalbot",
      status: "In progress",
      leaf: { model: "assets/builder_bot.glb", size: 1.3, spin: true },
      year: "2026",
      summary: "A bot that plays the real-time strategy game Beyond All Reason, built so every change can be benchmarked in matches that run headless, with no display.",
      body: [
        "The core bot plays the whole game: economy, scouting, defence, army production and army control. It is written as Lua widgets for the Spring engine: thin controllers over about 50 shared modules.",
        "A strategy is a small config on top of that core: what the army is made of, how much income it gets, and a finite state machine that switches stances as the match changes. Trying a new idea means writing a few lines, not a new bot.",
        "Around it sits the verification stack: 50+ test suites on a stubbed engine API, a headless match harness, and an economy simulator that runs the real bot code, about 25 seconds for a 20-minute game."
      ],
      tags: ["Lua", "Python", "RTS AI", "Beyond All Reason"],
      links: [
        { label: "Code on GitHub", url: "https://github.com/SeeingEyeTree/MetalBot" },
        { label: "About the game", url: "https://www.beyondallreason.info/" }
      ]
    },

    {
      title: "Game",
      short: "Game",
      slug: "game",
      status: "Shipped",
      leaf: { image: "assets/caffactory_can_purple.png", size: 1 },
      year: "2026",
      summary: "An automation simulation game with an in-game scripting language, playable in the browser.",
      body: [
        "Built in JavaScript and Electron with Claude Code. Players automate a factory by writing scripts in the game's own language. It has had 100 browser plays on itch.io.",
        "Next step: training an agent to play it."
      ],
      tags: ["JavaScript", "Electron", "Game"],
      links: [
        { label: "Play on itch.io", url: "https://iam-tree.itch.io/caff-infinat" }
      ]
    },
    {
      title: "Pittsburgh Electric Propulsion",
      short: "PEP",
      slug: "pep",
      status: "2023 - 2025",
      year: "2023",
      summary: "Software and controls for an autonomous electric boat, on the path planning team at the University of Pittsburgh.",
      body: [
        "Converted GPS and other sensor data into a unified frame of reference for the boat in ROS2, and coordinated with other teams so the path planning team received correct data.",
        "Worked on the path planning team with 9 others."
      ],
      tags: ["ROS2", "Path planning", "Sensor fusion"],
      links: [
        { label: "Boat model (.c4d, Cinema 4D)", url: "assets/boat.c4d" }
      ]
    },

    {
      title: "Open Gym",
      short: "Open Gym",
      slug: "open-gym",
      status: "2024 - 2026",
      year: "2024",
      summary: "Training pipelines for small models that solve Gymnasium environments, using Proximal Policy Optimization and Soft Actor-Critic.",
      body: [
        "Solved all of the Classic Control and Box2D Gymnasium environments, including Pendulum, MountainCar and BipedalWalker.",
        "The code lives in my AI-suff repo, along with the saved models and render scripts."
      ],
      tags: ["Python", "TensorFlow", "Gymnasium", "NumPy", "PPO", "SAC"],
      links: [
        { label: "Code on GitHub", url: "https://github.com/SeeingEyeTree/AI-suff" }
      ]
    },

    /* ---- unlit branches: fill in and delete "stub: true" to light one ---- */
    { stub: true, title: "", short: "", status: "", year: "", summary: "", body: [], tags: [], links: [], leaf: null },
    { stub: true, title: "", short: "", status: "", year: "", summary: "", body: [], tags: [], links: [], leaf: null },
    { stub: true, title: "", short: "", status: "", year: "", summary: "", body: [], tags: [], links: [], leaf: null },
    { stub: true, title: "", short: "", status: "", year: "", summary: "", body: [], tags: [], links: [], leaf: null },
    { stub: true, title: "", short: "", status: "", year: "", summary: "", body: [], tags: [], links: [], leaf: null }
  ]
};
