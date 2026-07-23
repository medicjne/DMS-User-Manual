/* ==========================================================================
   Software Documentation Hub - Application Logic (app.js)
   ========================================================================== */

// Global State
let guidesData = [];
let activeCategory = 'ALL';
let activeSoftware = 'ALL';
let currentGuideId = null;
let editingGuideId = null; // Track if we're editing an existing guide

// DOM Elements
const gridContainerView = document.getElementById('grid-container-view');
const readerView = document.getElementById('reader-view');
const heroSection = document.getElementById('hero-section');
const guidesGrid = document.getElementById('guides-grid');
const softwareSelectFilter = document.getElementById('software-select-filter');
const searchModal = document.getElementById('search-modal');
const adminModal = document.getElementById('admin-modal');
const modalSearchInput = document.getElementById('modal-search-input');
const modalSearchResults = document.getElementById('modal-search-results');
const toastContainer = document.getElementById('toast-container');
const readingProgress = document.getElementById('reading-progress');

/* ==========================================================================
   Initialization
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  await loadGuidesData();
  setupKeyboardShortcuts();
  setupScrollListener();
});

// Load Guides from JSON or LocalStorage fallback
async function loadGuidesData() {
  const localGuides = localStorage.getItem('docs_custom_guides');

  if (localGuides) {
    try {
      guidesData = JSON.parse(localGuides);
    } catch (e) {
      console.error('Error parsing local guides', e);
    }
  }

  // If empty or first run, fetch default JSON
  if (!guidesData || guidesData.length === 0) {
    try {
      const response = await fetch('data/guides.json');
      guidesData = await response.json();
      saveGuidesToLocal();
    } catch (err) {
      console.error('Failed to load default guides.json', err);
    }
  } else {
    // Migration mapping for existing local stored guides
    const categoryMap = {
      "Cài đặt & Khởi đầu": "Cài đặt",
      "Tính năng Cơ bản": "Đơn hàng",
      "Sửa lỗi FAQ": "Giám sát & phê duyệt",
      "Mẹo Nâng cao": "Báo cáo"
    };
    let updated = false;
    guidesData.forEach(g => {
      if (categoryMap[g.category]) {
        g.category = categoryMap[g.category];
        updated = true;
      }
    });
    if (updated) {
      saveGuidesToLocal();
    }
  }

  populateSoftwareFilterOptions();
  updateStatsCounters();
  renderGuides();
}

function saveGuidesToLocal() {
  localStorage.setItem('docs_custom_guides', JSON.stringify(guidesData));
}

/* ==========================================================================
   Theme Management (Light / Dark)
   ========================================================================== */

function initTheme() {
  const savedTheme = localStorage.getItem('docs_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeButtonIcon(savedTheme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('docs_theme', newTheme);
  updateThemeButtonIcon(newTheme);
  showToast(`Đã chuyển sang giao diện ${newTheme === 'dark' ? 'Tối 🌙' : 'Sáng ☀️'}`);
}

function updateThemeButtonIcon(theme) {
  const btn = document.getElementById('theme-toggle-btn');
  if (btn) {
    btn.innerHTML = theme === 'dark' ? '🌙' : '☀️';
  }
}

/* ==========================================================================
   Filter & Rendering Logic
   ========================================================================== */

function populateSoftwareFilterOptions() {
  const softwareSet = new Set(guidesData.map(g => g.software).filter(Boolean));
  softwareSelectFilter.innerHTML = '<option value="ALL">Tất cả phần mềm</option>';

  softwareSet.forEach(sw => {
    const opt = document.createElement('option');
    opt.value = sw;
    opt.textContent = sw;
    softwareSelectFilter.appendChild(opt);
  });
}

function updateStatsCounters() {
  const totalGuidesEl = document.getElementById('stat-total-guides');
  const totalViewsEl = document.getElementById('stat-total-views');

  if (totalGuidesEl) totalGuidesEl.textContent = guidesData.length;

  if (totalViewsEl) {
    const totalViews = guidesData.reduce((sum, g) => sum + (g.views || 0), 0);
    totalViewsEl.textContent = totalViews.toLocaleString('vi-VN') + '+';
  }
}

function filterByCategory(category, btnElement) {
  activeCategory = category;

  // Update active pill button UI
  const pillBtns = document.querySelectorAll('.pill-btn');
  pillBtns.forEach(btn => btn.classList.remove('active'));
  if (btnElement) btnElement.classList.add('active');

  renderGuides();
}

function filterBySoftware(software) {
  activeSoftware = software;
  renderGuides();
}

function renderGuides() {
  guidesGrid.innerHTML = '';

  const filtered = guidesData.filter(g => {
    const matchCategory = activeCategory === 'ALL' || g.category === activeCategory;
    const matchSoftware = activeSoftware === 'ALL' || g.software === activeSoftware;
    return matchCategory && matchSoftware;
  });

  if (filtered.length === 0) {
    guidesGrid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <h3>Không tìm thấy bài hướng dẫn nào</h3>
        <p style="color: var(--text-muted); margin-top: 0.5rem;">Hãy thử thay đổi từ khóa tìm kiếm hoặc chọn danh mục khác.</p>
      </div>
    `;
    return;
  }

  filtered.forEach(guide => {
    const card = document.createElement('div');
    card.className = 'guide-card';
    card.onclick = () => openGuideReader(guide.id);

    const editBtnHTML = isAdminLoggedIn
      ? `<button class="edit-card-btn" onclick="editGuide('${guide.id}', event)" title="Sửa bài viết này">🖊️ Sửa</button>`
      : `<button class="edit-card-btn" onclick="editGuide('${guide.id}', event)" title="Yêu cầu quyền Admin để sửa">🔒 Sửa</button>`;

    const deleteBtnHTML = isAdminLoggedIn
      ? `<button class="delete-card-btn" onclick="deleteGuide('${guide.id}', event)" title="Xóa bài viết này">🗑️ Xóa</button>`
      : `<button class="delete-card-btn" onclick="deleteGuide('${guide.id}', event)" title="Yêu cầu quyền Admin để xóa">🔒 Xóa</button>`;

    card.innerHTML = `
      <div>
        <div class="guide-header">
          <span class="guide-badge">${escapeHTML(guide.category)}</span>
          <div class="guide-header-actions">
            <span class="guide-software-tag">💻 ${escapeHTML(guide.software)}</span>
            ${editBtnHTML}
            ${deleteBtnHTML}
          </div>
        </div>
        <h3 class="guide-title">${escapeHTML(guide.title)}</h3>
        <p class="guide-summary">${escapeHTML(guide.subtitle || guide.summary || '')}</p>
      </div>
      <div class="guide-footer">
        <div class="guide-meta-item">⏱️ ${escapeHTML(guide.readingTime || '5 phút')}</div>
        <div class="guide-meta-item">👁️ ${guide.views || 0} lượt đọc</div>
        <div class="guide-meta-item">📅 ${escapeHTML(guide.updatedAt || 'Vừa cập nhật')}</div>
      </div>
    `;

    guidesGrid.appendChild(card);
  });

}

/* ==========================================================================
   Reader Detail View
   ========================================================================== */

function openGuideReader(guideId) {
  const guide = guidesData.find(g => g.id === guideId);
  if (!guide) return;

  currentGuideId = guideId;

  // Increment view count
  guide.views = (guide.views || 0) + 1;
  saveGuidesToLocal();
  updateStatsCounters();

  // Populate Article Info
  document.getElementById('reader-badge').textContent = guide.category;
  document.getElementById('reader-software').textContent = `💻 ${guide.software}`;
  document.getElementById('reader-time').textContent = `⏱️ ${guide.readingTime || '5 phút'} đọc`;
  document.getElementById('reader-date').textContent = `📅 ${guide.updatedAt}`;
  document.getElementById('reader-title').textContent = guide.title;
  document.getElementById('reader-subtitle').textContent = guide.subtitle || '';

  const readerBody = document.getElementById('reader-body');
  readerBody.innerHTML = guide.contentHTML;

  // Zoom image
  attachImageZoomHandlers();

  // Generate Sticky Table of Contents
  generateTOC(readerBody);

  // Switch View
  heroSection.style.display = 'none';
  gridContainerView.style.display = 'none';
  readerView.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showGridView() {
  readerView.classList.remove('active');
  heroSection.style.display = 'block';
  gridContainerView.style.display = 'block';
  readingProgress.style.width = '0%';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function generateTOC(container) {
  const tocList = document.getElementById('toc-list');
  tocList.innerHTML = '';

  const headings = container.querySelectorAll('h2, h3, h4');
  if (headings.length === 0) {
    tocList.innerHTML = '<li class="toc-link">Bài viết không có mục lớn</li>';
    return;
  }

  headings.forEach((heading, idx) => {
    const id = `toc-heading-${idx}`;
    heading.id = id;

    const tagName = heading.tagName.toLowerCase(); // 'h2', 'h3', 'h4'

    const li = document.createElement('li');
    const a = document.createElement('a');
    a.className = `toc-link level-${tagName}`;
    a.href = `#${id}`;

    // Add visual prefix indicator for sub-headings
    let prefix = '';
    if (tagName === 'h3') prefix = '• ';
    if (tagName === 'h4') prefix = '↳ ';

    a.textContent = prefix + heading.textContent;
    a.onclick = (e) => {
      e.preventDefault();

      // Calculate exact scroll position accounting for sticky navbar height (72px) + margin
      const navbarHeight = 90;
      const elementTop = heading.getBoundingClientRect().top + window.pageYOffset;
      const targetY = elementTop - navbarHeight;

      window.scrollTo({
        top: targetY,
        behavior: 'smooth'
      });
    };

    li.appendChild(a);
    tocList.appendChild(li);
  });
}

// Reading Scroll Progress Indicator & Active TOC Highlight
function setupScrollListener() {
  window.addEventListener('scroll', () => {
    if (!readerView.classList.contains('active')) return;

    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    readingProgress.style.width = `${Math.min(progress, 100)}%`;

    // Highlight active TOC item across H2, H3, H4
    const headings = document.querySelectorAll('.article-body h2, .article-body h3, .article-body h4');
    const tocLinks = document.querySelectorAll('.toc-link');

    const navbarOffset = 105;
    let currentIdx = -1;

    headings.forEach((h, idx) => {
      const top = h.getBoundingClientRect().top;
      if (top <= navbarOffset) {
        currentIdx = idx;
      }
    });

    tocLinks.forEach((link, idx) => {
      if (idx === currentIdx) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  });
}



/* ==========================================================================
   Code Copy & Feedback Interactions
   ========================================================================== */

function copyCode(btn) {
  const codeBlock = btn.closest('.code-block');
  if (!codeBlock) return;

  const codeText = codeBlock.querySelector('code').innerText;
  navigator.clipboard.writeText(codeText).then(() => {
    btn.innerHTML = '✅ Đã Copy!';
    showToast('Đã sao chép câu lệnh vào bộ nhớ tạm');
    setTimeout(() => {
      btn.innerHTML = '📋 Copy';
    }, 2000);
  });
}

function sendFeedback(isHelpful) {
  if (isHelpful) {
    showToast('Cảm ơn phản hồi tích cực của bạn! 🎉');
  } else {
    showToast('Cảm ơn đóng góp! Chúng tôi sẽ hoàn thiện bài viết sớm hơn. 🙏');
  }
}

function shareArticle() {
  const url = window.location.href;
  navigator.clipboard.writeText(url).then(() => {
    showToast('Đã copy đường dẫn liên kết bài viết!');
  });
}

/* ==========================================================================
   Search Modal & Realtime Fuzzy Filter (Ctrl + K)
   ========================================================================== */

function openSearchModal() {
  searchModal.classList.add('active');
  modalSearchInput.value = '';
  modalSearchInput.focus();
  handleRealtimeSearch('');
}

function closeSearchModal() {
  searchModal.classList.remove('active');
}

function handleRealtimeSearch(query) {
  modalSearchResults.innerHTML = '';
  const q = query.trim().toLowerCase();

  const results = guidesData.filter(g => {
    return g.title.toLowerCase().includes(q) ||
      g.category.toLowerCase().includes(q) ||
      g.software.toLowerCase().includes(q) ||
      (g.summary && g.summary.toLowerCase().includes(q)) ||
      (g.tags && g.tags.some(t => t.toLowerCase().includes(q)));
  });

  if (results.length === 0) {
    modalSearchResults.innerHTML = `<div style="text-align: center; color: var(--text-dim); padding: 1.5rem;">Không tìm thấy bài viết nào phù hợp với "${escapeHTML(query)}"</div>`;
    return;
  }

  results.forEach(g => {
    const item = document.createElement('div');
    item.className = 'search-result-item';
    item.onclick = () => {
      closeSearchModal();
      openGuideReader(g.id);
    };

    item.innerHTML = `
      <div style="font-weight: 700; margin-bottom: 0.2rem;">${escapeHTML(g.title)}</div>
      <div style="font-size: 0.8rem; color: var(--text-muted); display: flex; gap: 0.75rem;">
        <span>💻 ${escapeHTML(g.software)}</span>
        <span>🏷️ ${escapeHTML(g.category)}</span>
      </div>
    `;

    modalSearchResults.appendChild(item);
  });
}

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ctrl + K shortcut
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openSearchModal();
    }
    // Escape key closes modal
    if (e.key === 'Escape') {
      closeSearchModal();
      closeAdminModal();
      document.getElementById('lightbox-overlay').classList.remove('active'); // ← zoom ảnh nè
      document.body.style.overflow = '';
    }
  });
}

/* ==========================================================================
   Admin Guide Creator & Authentication Management
   ========================================================================== */

let isAdminLoggedIn = sessionStorage.getItem('docs_admin_auth') === 'true';
let currentImageDataURL = '';

function openAdminModal() {
  if (!isAdminLoggedIn) {
    openAdminAuthModal();
  } else {
    // Reset to create mode when opening from navbar
    if (!editingGuideId) {
      resetAdminFormToCreateMode();
    }
    document.getElementById('admin-modal').classList.add('active');
  }
}

function openAdminAuthModal() {
  document.getElementById('admin-auth-modal').classList.add('active');
  const pwdInput = document.getElementById('admin-password-input');
  if (pwdInput) {
    pwdInput.value = '';
    pwdInput.focus();
  }
}

function closeAdminAuthModal() {
  document.getElementById('admin-auth-modal').classList.remove('active');
}

function handleAdminLogin(e) {
  e.preventDefault();
  const password = document.getElementById('admin-password-input').value;

  // Default admin password is 'admin123'
  if (password === 'Dreambiz@2o26') {
    isAdminLoggedIn = true;
    sessionStorage.setItem('docs_admin_auth', 'true');
    closeAdminAuthModal();
    showToast('🔑 Xác thực Admin thành công!');
    renderGuides(); // Re-render guides to update admin delete icons

    // Open admin modal if it was triggered
    const adminModal = document.getElementById('admin-modal');
    if (adminModal) adminModal.classList.add('active');
  } else {
    showToast('❌ Mật khẩu Admin không chính xác');
  }
}

function logoutAdmin() {
  isAdminLoggedIn = false;
  sessionStorage.removeItem('docs_admin_auth');
  closeAdminModal();
  renderGuides();
  showToast('🔒 Đã đăng xuất quyền Admin');
}

/* ==========================================================================
   Delete Article Logic (Admin Only)
   ========================================================================== */

function deleteGuide(guideId, event) {
  if (event) event.stopPropagation();

  if (!isAdminLoggedIn) {
    showToast('🔒 Bạn cần quyền Admin để xóa bài viết này!');
    openAdminAuthModal();
    return;
  }

  const guide = guidesData.find(g => g.id === guideId);
  if (!guide) return;

  if (confirm(`⚠️ CẢNH BÁO: Bạn có chắc chắn muốn xóa bài viết:\n"${guide.title}"?\n\nHành động này không thể hoàn tác!`)) {
    guidesData = guidesData.filter(g => g.id !== guideId);
    saveGuidesToLocal();
    populateSoftwareFilterOptions();
    updateStatsCounters();
    renderGuides();

    if (currentGuideId === guideId) {
      showGridView();
    }

    showToast('🗑️ Đã xóa bài viết thành công!');
  }
}

function deleteCurrentArticle() {
  if (currentGuideId) {
    deleteGuide(currentGuideId, null);
  }
}

/* ==========================================================================
   Edit Article Logic (Admin Only)
   ========================================================================== */

function editGuide(guideId, event) {
  if (event) event.stopPropagation();

  if (!isAdminLoggedIn) {
    showToast('🔒 Bạn cần quyền Admin để sửa bài viết này!');
    openAdminAuthModal();
    return;
  }

  const guide = guidesData.find(g => g.id === guideId);
  if (!guide) return;

  editingGuideId = guideId;
  populateEditForm(guide);
  document.getElementById('admin-modal').classList.add('active');
}

function editCurrentArticle() {
  if (currentGuideId) {
    editGuide(currentGuideId, null);
  }
}

function populateEditForm(guide) {
  // Update modal title to indicate editing
  const modalTitle = document.querySelector('#admin-modal .modal-title');
  if (modalTitle) {
    modalTitle.innerHTML = `🖊️ Chỉnh Sửa Bài Viết <span class="admin-status-badge">📝 Đang sửa</span>`;
  }

  // Update submit button text
  const submitBtn = document.querySelector('#guide-admin-form button[type="submit"]');
  if (submitBtn) {
    submitBtn.innerHTML = '💾 Cập Nhật Bài Viết';
  }

  // Fill form fields
  document.getElementById('form-title').value = guide.title || '';
  document.getElementById('form-subtitle').value = guide.subtitle || '';
  document.getElementById('form-software').value = guide.software || '';
  document.getElementById('form-category').value = guide.category || '';
  document.getElementById('form-reading-time').value = guide.readingTime || '';
  document.getElementById('form-tags').value = (guide.tags || []).join(', ');

  // Fill rich editor with existing content
  const editorEl = document.getElementById('rich-editor');
  if (editorEl) {
    editorEl.innerHTML = guide.contentHTML || '';
  }
}

function resetAdminFormToCreateMode() {
  editingGuideId = null;

  // Restore modal title
  const modalTitle = document.querySelector('#admin-modal .modal-title');
  if (modalTitle) {
    modalTitle.innerHTML = `✍️ Đăng / Quản lý Bài Hướng Dẫn <span class="admin-status-badge">✅ Đã xác thực Admin</span>`;
  }

  // Restore submit button text
  const submitBtn = document.querySelector('#guide-admin-form button[type="submit"]');
  if (submitBtn) {
    submitBtn.innerHTML = '💾 Đăng / Lưu Bài Hướng Dẫn';
  }

  // Clear form
  document.getElementById('guide-admin-form').reset();
  const editorEl = document.getElementById('rich-editor');
  if (editorEl) editorEl.innerHTML = '';
}


function closeAdminModal() {
  document.getElementById('admin-modal').classList.remove('active');
  // Reset editing state when closing
  editingGuideId = null;
  resetAdminFormToCreateMode();
}

/* Image Upload & Base64 Converter */
function handleImageFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    showToast('⚠️ Vui lòng chọn tệp định dạng hình ảnh!');
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    currentImageDataURL = e.target.result;
    document.getElementById('image-url-input').value = '';
    showImagePreview(currentImageDataURL);
    showToast('📷 Đã tải ảnh lên bộ nhớ tạm!');
  };
  reader.readAsDataURL(file);
}

function handleImageURLInput(url) {
  if (url.trim()) {
    currentImageDataURL = url.trim();
    showImagePreview(currentImageDataURL);
  } else {
    hideImagePreview();
  }
}

function showImagePreview(src) {
  const previewImg = document.getElementById('image-preview-element');
  if (previewImg) {
    previewImg.src = src;
    previewImg.style.display = 'block';
  }
}

function hideImagePreview() {
  const previewImg = document.getElementById('image-preview-element');
  if (previewImg) {
    previewImg.style.display = 'none';
  }
}

/* WYSIWYG Rich Text Editor Commands */
function execCmd(command, value = null) {
  document.execCommand(command, false, value);
  const editor = document.getElementById('rich-editor');
  if (editor) editor.focus();
}

function insertCallout(type) {
  let title = 'Ghi chú:';
  let icon = '💡';
  let classType = 'callout-note';

  if (type === 'tip') {
    title = 'Mẹo nhỏ:';
    icon = '✅';
    classType = 'callout-tip';
  } else if (type === 'warning') {
    title = 'Cảnh báo:';
    icon = '⚠️';
    classType = 'callout-warning';
  }

  const html = `<div class="callout ${classType}"><span class="callout-icon">${icon}</span><div><strong>${title}</strong> Nhập nội dung ghi chú tại đây...</div></div><p><br></p>`;
  insertHTMLToEditor(html);
}

function insertStepCard() {
  const stepCount = document.querySelectorAll('#rich-editor .step-card').length + 1;
  const html = `<div class="step-card"><span class="step-number">${stepCount}</span><span class="step-title">Bước ${stepCount}: Tên bước thực hiện</span><p>Mô tả chi tiết bước thực hiện tại đây...</p></div><p><br></p>`;
  insertHTMLToEditor(html);
}

function insertCodeSnippet() {
  const html = `<div class="code-block"><div class="code-header"><span>Lệnh Command Prompt / Code</span><button class="copy-code-btn" onclick="copyCode(this)">📋 Copy</button></div><pre><code>// Nhập mã lệnh tại đây</code></pre></div><p><br></p>`;
  insertHTMLToEditor(html);
}

function insertHTMLToEditor(html) {
  const editor = document.getElementById('rich-editor');
  if (!editor) return;

  editor.focus();
  const sel = window.getSelection();
  if (sel.getRangeAt && sel.rangeCount) {
    let range = sel.getRangeAt(0);
    range.deleteContents();

    const el = document.createElement("div");
    el.innerHTML = html;
    let frag = document.createDocumentFragment(), node, lastNode;
    while ((node = el.firstChild)) {
      lastNode = frag.appendChild(node);
    }
    range.insertNode(frag);

    if (lastNode) {
      range = range.cloneRange();
      range.setStartAfter(lastNode);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  } else {
    editor.innerHTML += html;
  }
}

function insertImageToContentTextarea() {
  const imgSrc = currentImageDataURL || document.getElementById('image-url-input').value.trim();
  const caption = document.getElementById('image-caption-input').value.trim();

  if (!imgSrc) {
    showToast('⚠️ Vui lòng chọn tệp ảnh hoặc nhập Link Ảnh trước khi chèn!');
    return;
  }

  const captionHTML = caption ? `<p class="article-img-caption">${escapeHTML(caption)}</p>` : '';
  const imageHTML = `<div class="article-img-wrap"><img src="${imgSrc}" alt="${escapeHTML(caption || 'Hình ảnh hướng dẫn')}" class="article-img">${captionHTML}</div><p><br></p>`;

  insertHTMLToEditor(imageHTML);

  // Clear image inputs
  document.getElementById('image-file-input').value = '';
  document.getElementById('image-url-input').value = '';
  document.getElementById('image-caption-input').value = '';
  currentImageDataURL = '';
  hideImagePreview();

  showToast('🖼️ Đã chèn ảnh vào nội dung bài viết!');
}

function handleSaveGuide(e) {
  e.preventDefault();

  if (!isAdminLoggedIn) {
    showToast('🔒 Bạn cần quyền Admin để thực hiện thao tác này!');
    openAdminAuthModal();
    return;
  }

  const title = document.getElementById('form-title').value.trim();
  const subtitle = document.getElementById('form-subtitle').value.trim();
  const software = document.getElementById('form-software').value.trim();
  const category = document.getElementById('form-category').value;
  const readingTime = document.getElementById('form-reading-time').value.trim() || '5 phút';
  const tagsRaw = document.getElementById('form-tags').value;

  // Retrieve rich text innerHTML directly from Google Docs style Editor
  const editorEl = document.getElementById('rich-editor');
  const contentHTML = editorEl ? editorEl.innerHTML.trim() : '';

  if (!contentHTML || contentHTML === '<br>') {
    showToast('⚠️ Vui lòng nhập nội dung bài viết hướng dẫn!');
    return;
  }

  const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);

  if (editingGuideId) {
    // === UPDATE MODE ===
    const guideIndex = guidesData.findIndex(g => g.id === editingGuideId);
    if (guideIndex === -1) {
      showToast('❌ Không tìm thấy bài viết để cập nhật!');
      return;
    }

    guidesData[guideIndex] = {
      ...guidesData[guideIndex],
      title,
      subtitle,
      category,
      software,
      readingTime,
      updatedAt: new Date().toISOString().split('T')[0],
      tags,
      summary: subtitle || title,
      contentHTML
    };

    saveGuidesToLocal();
    populateSoftwareFilterOptions();
    updateStatsCounters();
    renderGuides();

    const updatedId = editingGuideId;
    closeAdminModal();
    showToast('✅ Đã cập nhật bài viết thành công!');

    // Refresh reader view if currently viewing this guide
    if (currentGuideId === updatedId) {
      openGuideReader(updatedId);
    }
  } else {
    // === CREATE MODE ===
    const newGuide = {
      id: `guide-${Date.now()}`,
      title,
      subtitle,
      category,
      software,
      readingTime,
      updatedAt: new Date().toISOString().split('T')[0],
      views: 1,
      tags,
      summary: subtitle || title,
      contentHTML
    };

    guidesData.unshift(newGuide);
    saveGuidesToLocal();
    populateSoftwareFilterOptions();
    updateStatsCounters();
    renderGuides();

    closeAdminModal();
    showToast('Đã đăng bài hướng dẫn mới! 🚀');

    // Open the newly created guide immediately
    openGuideReader(newGuide.id);
  }
}



function exportGuidesJSON() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(guidesData, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", "guides_backup.json");
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast('Đã tải xuống file sao lưu guides_backup.json!');
}

async function resetToDefaultData() {
  if (confirm('Bạn có chắc chắn muốn khôi phục lại dữ liệu bài hướng dẫn mẫu ban đầu không?')) {
    localStorage.removeItem('docs_custom_guides');
    await loadGuidesData();
    closeAdminModal();
    showToast('Đã khôi phục lại dữ liệu mẫu ban đầu!');
  }
}

/* ==========================================================================
   Toast Notification Utility
   ========================================================================== */

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>💬</span><span>${escapeHTML(message)}</span>`;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g,
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

/* ==========================================================================
   Image Lightbox (Zoom ảnh trong bài viết)
   ========================================================================== */

function openLightbox(imgEl) {
  const overlay = document.getElementById('lightbox-overlay');
  const lightboxImg = document.getElementById('lightbox-img');
  lightboxImg.src = imgEl.src;
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden'; // khóa scroll nền khi xem ảnh
}

function closeLightbox(event) {
  // Chỉ đóng khi click đúng vào overlay/nút đóng, không đóng khi click vào chính ảnh
  if (event && event.target.tagName === 'IMG') return;

  document.getElementById('lightbox-overlay').classList.remove('active');
  document.body.style.overflow = '';
}

function attachImageZoomHandlers() {
  const images = document.querySelectorAll('.article-body img');
  images.forEach(img => {
    img.onclick = () => openLightbox(img);
  });
}