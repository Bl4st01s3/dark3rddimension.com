const stage = document.querySelector("[data-holo]");

if (stage && window.matchMedia("(pointer: fine)").matches) {
  stage.addEventListener("pointermove", (event) => {
    const bounds = stage.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    stage.style.transform = `perspective(900px) rotateX(${y * -8}deg) rotateY(${x * 10}deg)`;
  });

  stage.addEventListener("pointerleave", () => {
    stage.style.transform = "";
  });
}

// Project Loading and Rendering
document.addEventListener("DOMContentLoaded", () => {
  if (typeof projectData !== 'undefined') {
    renderProjects(projectData.workbench, 'workbench-grid');
    renderProjects(projectData.archive, 'archive-grid');
    renderProjects(projectData.background_threads, 'background-threads-grid');
  } else {
    console.error("projectData is not defined. Ensure projects.js is loaded.");
  }
});

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
          <p>${project.description}</p>
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
