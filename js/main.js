// Interactive Hologram stage (3D parallax, click transitions, and 3D model loading)
// is managed in js/holo-viewer.js.

// Project Loading and Rendering
document.addEventListener("DOMContentLoaded", () => {
  initHoloMenu();

  if (typeof projectData !== 'undefined') {
    renderProjects(projectData.workbench, 'workbench-grid');
    renderProjects(projectData.archive, 'archive-grid');
    renderProjects(projectData.background_threads, 'background-threads-grid');
  } else {
    console.error("projectData is not defined. Ensure projects.js is loaded.");
  }
});

function initHoloMenu() {
  const menuDock = document.querySelector(".holo-menu-dock");
  const projectorBtn = menuDock?.querySelector(".menu-projector-btn");
  const menuLinks = menuDock?.querySelectorAll(".holo-menu-link");

  if (!menuDock || !projectorBtn) return;

  // --- Sound state ---
  let isPowered = false;       // Is the menu projector currently switched on?
  let currentAimDeg = 0;       // Current turret tilt (used to only play the move sound on real changes)
  let aimResetTimer = null;

  function powerOn() {
    if (isPowered) return;
    isPowered = true;
    window.D3DSound?.play("turnOn");
  }

  function powerOffIfIdle() {
    if (menuDock.classList.contains("is-open")) return;
    if (menuDock.matches(":hover") || menuDock.contains(document.activeElement)) return;
    isPowered = false;
  }

  function setAim(aimDeg, flapBoost) {
    menuDock.style.setProperty("--menu-turret-angle", `${aimDeg}deg`);
    menuDock.style.setProperty("--menu-flap-boost", flapBoost);
    if (aimDeg !== currentAimDeg) {
      currentAimDeg = aimDeg;
      window.D3DSound?.play("move", { cooldown: 90 });
    }
  }

  // Projector turns on when the mouse moves over it (or it receives keyboard focus)
  menuDock.addEventListener("pointerenter", powerOn);
  menuDock.addEventListener("focusin", powerOn);
  menuDock.addEventListener("pointerleave", () => setTimeout(powerOffIfIdle, 0));
  menuDock.addEventListener("focusout", () => setTimeout(powerOffIfIdle, 0));

  // Toggle open state on button click (for touch devices or click-to-pin)
  projectorBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = menuDock.classList.toggle("is-open");
    projectorBtn.setAttribute("aria-expanded", String(isOpen));
    if (isOpen) {
      powerOn();
    } else {
      setTimeout(powerOffIfIdle, 0);
    }
  });

  // Aim the menu projector turret at whichever holographic menu link is hovered
  menuLinks?.forEach((link) => {
    link.addEventListener("pointerenter", () => {
      clearTimeout(aimResetTimer);
      const aimDeg = Number(link.getAttribute("data-aim") || 0);
      setAim(aimDeg, "3.5deg");
    });

    link.addEventListener("pointerleave", () => {
      // Short delay so moving directly between links doesn't snap back to centre first
      clearTimeout(aimResetTimer);
      aimResetTimer = setTimeout(() => setAim(0, "0deg"), 120);
    });

    link.addEventListener("click", () => {
      menuDock.classList.remove("is-open");
      projectorBtn.setAttribute("aria-expanded", "false");
    });
  });

  // Close pinned menu when clicking outside
  document.addEventListener("click", (e) => {
    if (!menuDock.contains(e.target)) {
      menuDock.classList.remove("is-open");
      projectorBtn.setAttribute("aria-expanded", "false");
      setTimeout(powerOffIfIdle, 0);
    }
  });
}

function renderProjects(projects, gridId) {
  const grid = document.getElementById(gridId);
  if (!grid || !projects) return;

  grid.innerHTML = ''; // Clear loading state or empty content

  projects.forEach(project => {
    const article = document.createElement('article');
    article.className = 'holo-tile';

    // Determine image sources from counts object or legacy images array
    let imageSources = [];
    if (project.counts && project.image_folder) {
      const folder = project.image_folder.endsWith('/') ? project.image_folder : project.image_folder + '/';
      // Process counts for each file extension (e.g. { "png": 1, "jpg": 2 })
      Object.keys(project.counts).forEach(ext => {
        const count = project.counts[ext];
        for (let i = 1; i <= count; i++) {
          imageSources.push(`${folder}${i}.${ext}`);
        }
      });
    } else if (project.images && project.images.length > 0) {
      imageSources = project.images;
    }

    // Build image container if images exist
    let imageHtml = '';
    if (imageSources.length > 0) {
      const imagesHtml = imageSources.map((src, index) =>
        `<img src="${src}" class="tile-image ${index === 0 ? 'active' : ''}" alt="${project.title} preview">`
      ).join('');

      imageHtml = `
        <div class="tile-image-container" data-slideshow="${imageSources.length > 1 ? 'true' : 'false'}">
          ${imagesHtml}
        </div>
      `;
    }

    // Status chip class
    const chipClass = project.status.toUpperCase() === 'LIVE' ? 'chip live' : 'chip';

    article.innerHTML = `
      <a href="${project.link || '#'}" class="holo-tile-link">
        <div class="tile-frame">
          ${imageHtml}
          <p class="mono">${project.id}</p>
          <h3>${project.title}</h3>
          <p>${project.description.length > 150 ? project.description.substring(0, 147) + '...' : project.description}</p>
          <span class="${chipClass}">${project.status}</span>
        </div>
      </a>
    `;

    grid.appendChild(article);
  });

  // Re-initialize 3D hover effect on new tiles
  const newStage = document.querySelector(".layout-core"); // The wrapper
  if (newStage && window.matchMedia("(pointer: fine)").matches) {
     // The event listener is already on the layout-core via data-holo,
     // but we can add specific hover effects if needed. The CSS handles the main visual changes.
  }

  // Initialize Slideshows
  initSlideshows(grid);
}

function initSlideshows(grid) {
  const containers = grid.querySelectorAll('.tile-image-container[data-slideshow="true"]');

  containers.forEach(container => {
    const images = container.querySelectorAll('.tile-image');
    let currentIndex = 0;

    setInterval(() => {
      // Remove active and glitch classes from all
      images.forEach(img => {
        img.classList.remove('active');
        img.classList.remove('glitch');
      });

      // Calculate next index
      currentIndex = (currentIndex + 1) % images.length;
      const nextImg = images[currentIndex];

      // Apply active and glitch classes to trigger animation
      nextImg.classList.add('active');

      // Force reflow to restart CSS animation
      void nextImg.offsetWidth;

      nextImg.classList.add('glitch');

    }, 3500); // Change image every 3.5 seconds
  });
}
