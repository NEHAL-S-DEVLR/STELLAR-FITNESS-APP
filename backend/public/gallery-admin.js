// Gallery management (includes Equipment photos) — gallery-admin.js

(async function () {
  if (!Auth.token) { location.href = '/'; return; }
  let me;
  try { me = await api('/api/me'); }
  catch { location.href = '/'; return; }
  if (me.role !== 'admin') { location.href = '/profile.html'; return; }

  renderAdminNav('gallery', me);

  document.getElementById('user-chip').innerHTML = `
    <div class="avatar admin">${initials(me.name)}</div>
    <span>${me.name}</span>
    <span class="chip primary">Admin</span>
  `;

  function showError(id, msg) {
    const el = document.getElementById(id);
    el.textContent = msg; el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 5000);
  }

  let items = [];
  let mode = 'upload';

  function setMode(m) {
    mode = m;
    document.getElementById('gal-tab-upload').classList.toggle('active', m === 'upload');
    document.getElementById('gal-tab-url').classList.toggle('active', m === 'url');
    document.getElementById('gal-upload-form').style.display = m === 'upload' ? '' : 'none';
    document.getElementById('gal-url-form').style.display = m === 'url' ? '' : 'none';
  }
  document.getElementById('gal-tab-upload').addEventListener('click', () => setMode('upload'));
  document.getElementById('gal-tab-url').addEventListener('click', () => setMode('url'));

  document.getElementById('gal-file').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    const preview = document.getElementById('gal-preview');
    const img = document.getElementById('gal-preview-img');
    if (!file) { preview.style.display = 'none'; return; }
    img.src = URL.createObjectURL(file);
    preview.style.display = 'block';
  });

  async function loadGallery() {
    document.getElementById('gallery-loading').style.display = 'block';
    document.getElementById('gallery-grid').style.display = 'none';
    document.getElementById('gallery-empty').style.display = 'none';
    try {
      items = await api('/api/admin/gallery');
      document.getElementById('gallery-loading').style.display = 'none';
      if (items.length === 0) { document.getElementById('gallery-empty').style.display = 'block'; return; }
      document.getElementById('gallery-grid').style.display = 'grid';
      renderGallery();
    } catch (e) {
      document.getElementById('gallery-loading').style.display = 'none';
      showError('error-banner', 'Failed to load gallery: ' + e.message);
    }
  }

  function renderGallery() {
    document.getElementById('gallery-grid').innerHTML = items.map(item => `
      <div class="card" style="padding: 0; overflow: hidden;">
        <img src="${item.image_url}" alt="${item.title}" style="width:100%; height:140px; object-fit:cover; display:block;" />
        <div style="padding: 12px;">
          <div style="font-weight:600; font-size:13px; margin-bottom:4px;">${item.title}</div>
          <span class="chip">${item.category}</span>
          <button class="btn btn-danger sm" data-delete="${item.id}" style="float:right;">
            <span class="material-symbols-rounded">delete</span>
          </button>
        </div>
      </div>
    `).join('');

    document.getElementById('gallery-grid').querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', () => deleteItem(parseInt(btn.dataset.delete)));
    });
  }

  async function deleteItem(id) {
    if (!confirm('Delete this photo?')) return;
    try {
      await api(`/api/admin/gallery/${id}`, { method: 'DELETE' });
      await loadGallery();
    } catch (e) {
      showError('error-banner', 'Failed to delete: ' + e.message);
    }
  }

  document.getElementById('add-gal-btn').addEventListener('click', async () => {
    document.getElementById('add-error').textContent = '';
    document.getElementById('add-error').classList.remove('show');

    const category = document.getElementById('gal-category').value;
    const title = document.getElementById('gal-title').value.trim();
    if (!title) return showError('add-error', 'Please enter a title.');

    const btn = document.getElementById('add-gal-btn');
    btn.disabled = true;

    try {
      let imageUrl;
      if (mode === 'upload') {
        const fileInput = document.getElementById('gal-file');
        const file = fileInput.files && fileInput.files[0];
        if (!file) { showError('add-error', 'Please choose an image.'); return; }
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/api/admin/gallery/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${Auth.token}` },
          body: fd,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Upload failed');
        }
        imageUrl = (await res.json()).url;
      } else {
        imageUrl = document.getElementById('gal-url').value.trim();
        if (!imageUrl) { showError('add-error', 'Please enter an image URL.'); return; }
      }

      await api('/api/admin/gallery', { method: 'POST', body: { category, title, image_url: imageUrl } });

      document.getElementById('gal-title').value = '';
      document.getElementById('gal-url').value = '';
      document.getElementById('gal-file').value = '';
      document.getElementById('gal-preview').style.display = 'none';
      await loadGallery();
    } catch (e) {
      showError('add-error', 'Failed to add: ' + e.message);
    } finally {
      btn.disabled = false;
    }
  });

  setMode('upload');
  await loadGallery();
})();
