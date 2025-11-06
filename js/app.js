/* ===== Utilitários ===== */
const q = (sel, ctx=document) => ctx.querySelector(sel);
const qa = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));
const formatCurrency = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

// Animação de adicionar ao carrinho
function animateAddToCart(sourceElement, product) {
  const cartIcon = q('#open-cart-btn');
  if (!sourceElement || !cartIcon) {
    cart.add(product, 1);
    showToast(`${product.name} adicionado ao carrinho.`);
    return;
  }

  const imgRect = sourceElement.getBoundingClientRect();
  const cartRect = cartIcon.getBoundingClientRect();
  
  const imgClone = sourceElement.cloneNode(true);
  imgClone.style.cssText = `
    position: fixed;
    z-index: 1000;
    top: ${imgRect.top}px;
    left: ${imgRect.left}px;
    width: ${imgRect.width}px;
    height: ${imgRect.height}px;
    transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    pointer-events: none;
  `;
  
  document.body.appendChild(imgClone);
  
  // Força reflow
  imgClone.offsetWidth;
  
  imgClone.style.cssText += `
    transform: translate(
      ${cartRect.left - imgRect.left}px,
      ${cartRect.top - imgRect.top}px
    ) scale(0.2);
    opacity: 0;
  `;
  
  cartIcon.classList.add('pulse');
  
  setTimeout(() => {
    imgClone.remove();
    cartIcon.classList.remove('pulse');
    cart.add(product, 1);
    showToast(`${product.name} adicionado ao carrinho.`);
  }, 600);
}

// Função de debounce para otimizar buscas
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Cache de produtos usando IndexedDB
const ProductCache = {
  dbName: 'noscope-store',
  storeName: 'products',
  db: null,

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'id' });
        }
      };
    });
  },

  async set(products) {
    const tx = this.db.transaction(this.storeName, 'readwrite');
    const store = tx.objectStore(this.storeName);
    
    for (const product of products) {
      store.put(product);
    }
    
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async get() {
    const tx = this.db.transaction(this.storeName, 'readonly');
    const store = tx.objectStore(this.storeName);
    const request = store.getAll();
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
};

/* ===== Toggle menu ===== */
const navbar = q(".navbar");
const menuButton = q(".menu-button");
if (menuButton) {
  menuButton.addEventListener("click", () => {
    navbar.classList.toggle("show-menu");
  });
}

/* ===== Dados de exemplo ===== */
const PRODUCTS = [
  { id: 'p1', name: 'Combo Gamer', price: 4000.00, category: 'Periféricos', images: ['./images/images/products/product-4.png'], description: 'Combo completo para gamers iniciantes.' },
  { id: 'p2', name: 'Smartband 4', price: 199.90, category: 'Wearables', images: ['./images/images/exclusive.png'], description: 'Acompanhe sua atividade física.' },
  { id: 'p3', name: 'Placa de Video', price: 349.90, category: 'Periféricos', images: ['./images/images/products/product-5.png'], description: 'Som imersivo com microfone flexível.' },
  { id: 'p4', name: 'Controle PS5', price: 899.00, category: 'Móveis', images: ['./images/images/products/product-6.png'], description: 'Cadeira ergonômica para longas sessões.' },
  { id: 'p5', name: 'Cadeira Gamer', price: 299.90, category: 'Periféricos', images: ['./images/images/products/product-7.png'], description: 'Switches azuis, iluminação RGB.' },
];

/* ===== Classe Cart ===== */
class Cart {
  constructor() {
    this.key = 'cart';
    this.items = this.load();
  }
  add(product, qty=1) {
    const found = this.items.find(i => i.id === product.id);
    if (found) found.qty += qty;
    else this.items.push({ id: product.id, name: product.name, price: product.price, qty, image: product.images[0] });
    this.save();
  }
  updateQty(productId, qty) {
    this.items = this.items.map(i => i.id === productId ? { ...i, qty } : i).filter(i => i.qty > 0);
    this.save();
  }
  remove(productId) {
    this.items = this.items.filter(i => i.id !== productId);
    this.save();
  }
  clear() { this.items = []; this.save(); }
  subtotal() { return this.items.reduce((s,i)=> s + i.price * i.qty, 0); }
  save() { localStorage.setItem(this.key, JSON.stringify(this.items)); updateCartUI(); }
  load() { const raw = localStorage.getItem(this.key); return raw ? JSON.parse(raw) : []; }
}
const cart = new Cart();

/* ===== Refs DOM ===== */
const catalogEl = q('#catalog');
const searchEl = q('#search');
const catFilterEl = q('#categoryFilter');
const sortEl = q('#sort');
const cartItemsEl = q('#cartItems');
const cartSubtotalEl = q('#cartSubtotal');
const freteValueEl = q('#freteValue');
const cartTotalEl = q('#cartTotal');
const checkoutForm = q('#checkoutForm');
const cepInput = q('#cep');
const cepHelp = q('#cepHelp');
const numberInput = q('#number');
const toast = q('#toast');

/* ===== Inicialização ===== */
async function init() {
  try {
    // Inicializa o cache
    await ProductCache.init();
    
    // Tenta carregar produtos do cache primeiro
    let cachedProducts = await ProductCache.get();
    if (!cachedProducts.length) {
      cachedProducts = PRODUCTS;
      await ProductCache.set(PRODUCTS);
    }

    if (catFilterEl) populateCategories();
    if (catalogEl) {
      // Adiciona loading state
      catalogEl.innerHTML = '<div class="loading">Carregando produtos...</div>';
      renderCatalog(cachedProducts);
    }
    
    attachEvents();
    updateCartUI();

    // Registra service worker para PWA
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('/service-worker.js');
        console.log('Service Worker registrado com sucesso');
      } catch (error) {
        console.error('Erro ao registrar Service Worker:', error);
      }
    }
  } catch (error) {
    console.error('Erro na inicialização:', error);
    showToast('Erro ao carregar produtos. Por favor, recarregue a página.', 'error');
  }
}

// Inicializa quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', init);

/* ===== Render catálogo ===== */
function populateCategories() {
  const cats = Array.from(new Set(PRODUCTS.map(p=>p.category)));
  cats.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c; opt.textContent = c;
    catFilterEl.appendChild(opt);
  });
}

function renderCatalog(list) {
  // Primeiro, mostra o skeleton loading
  if (list && list.length > 0) {
    catalogEl.innerHTML = Array(8).fill(0).map(() => `
      <article class="product-skeleton">
        <div class="product-skeleton-img skeleton"></div>
        <div class="product-skeleton-text skeleton"></div>
        <div class="product-skeleton-price skeleton"></div>
      </article>
    `).join('');
  }

  // Cria o Intersection Observer para lazy loading
  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.src;
        img.classList.remove('lazy');
        observer.unobserve(img);
      }
    });
  });

  // Renderiza os produtos após um pequeno delay para mostrar o skeleton
  setTimeout(() => {
    catalogEl.innerHTML = '';
    if (!list || list.length === 0) {
      catalogEl.innerHTML = `
        <div class="no-results">
          <i class="fas fa-search" style="font-size: 2rem; margin-bottom: 1rem;"></i>
          <p>Nenhum produto encontrado.</p>
        </div>
      `;
      return;
    }

    list.forEach(p => {
      const card = document.createElement('article');
      card.className = 'product';
      card.innerHTML = `
        <div class="product-image-container">
          <img 
            class="lazy" 
            src="data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=="
            data-src="${p.images[0] || ''}"
            alt="${p.name}"
            loading="lazy"
          />
          <div class="product-overlay">
            <button class="quick-view-btn" data-id="${p.id}">
              <i class="fas fa-eye"></i>
            </button>
          </div>
        </div>
        <div class="product-info">
          <p class="product-name">${p.name}</p>
          <div class="product-rating">
            <div class="stars">
              ${Array(5).fill(0).map((_, i) => `
                <i class="fas fa-star${i < 4 ? ' active' : ''}"></i>
              `).join('')}
            </div>
            <span class="rating-count">(4.0)</span>
          </div>
          <p class="product-price">${formatCurrency(p.price)}</p>
          <div class="product-actions">
            <button class="view-btn btn-secondary" data-id="${p.id}">
              <i class="fas fa-eye"></i> Ver detalhes
            </button>
            <button class="add-btn btn-primary" data-id="${p.id}">
              <i class="fas fa-cart-plus"></i> Adicionar
            </button>
          </div>
        </div>
      `;

      // Observa as imagens para lazy loading
      const img = card.querySelector('img.lazy');
      imageObserver.observe(img);

      catalogEl.appendChild(card);
    });

    // Adiciona animação de entrada nos cards
    qa('.product').forEach((card, index) => {
      card.style.animation = `fadeInUp 0.3s ease forwards ${index * 0.1}s`;
    });
  }, 1000);
}


/* ===== Eventos ===== */
function attachEvents() {
  if (searchEl) searchEl.addEventListener('input', applyFilters);
  if (catFilterEl) catFilterEl.addEventListener('change', applyFilters);
  if (sortEl) sortEl.addEventListener('change', applyFilters);

  if (catalogEl) {
    catalogEl.addEventListener('click', e => {
      const view = e.target.closest('.view-btn');
      const add = e.target.closest('.add-btn');
      if (view) openProductModal(view.dataset.id);
      if (add) {
        const prod = PRODUCTS.find(p => p.id === add.dataset.id);
        cart.add(prod, 1);
        showToast(`${prod.name} adicionado ao carrinho.`);
      }
    });
  }

  const openCartBtn = q('#open-cart-btn');
  const closeCartBtn = q('#close-cart');
  if (openCartBtn) openCartBtn.addEventListener('click', ()=> toggleCart(true));
  if (closeCartBtn) closeCartBtn.addEventListener('click', ()=> toggleCart(false));

  if (cartItemsEl) {
    cartItemsEl.addEventListener('click', e => {
      const btn = e.target.closest('.remove-item');
      if (btn) cart.remove(btn.dataset.id);
    });
    cartItemsEl.addEventListener('change', e => {
      if (e.target.matches('.item-qty')) {
        const id = e.target.dataset.id;
        const qty = parseInt(e.target.value, 10) || 1;
        cart.updateQty(id, qty);
      }
    });
  }

  if (checkoutForm) {
    checkoutForm.addEventListener('submit', e => {
      e.preventDefault();
      if (cart.items.length === 0) return showToast('Carrinho vazio.', 'error');
      showToast('Pedido finalizado com sucesso!', 'success');
      cart.clear();
      toggleCart(false);
    });
  }

  if (cepInput) cepInput.addEventListener('input', onCepInput);

  const modal = q('#productModal');
  if (modal) {
    modal.addEventListener('click', e => {
      if (e.target === modal || e.target.classList.contains('close-modal')) closeModal();
    });
    const addModalBtn = q('#addToCartFromModal');
    if (addModalBtn) {
      addModalBtn.addEventListener('click', () => {
        const pid = addModalBtn.dataset.id;
        const prod = PRODUCTS.find(p => p.id === pid);
        cart.add(prod, 1);
        showToast(`${prod.name} adicionado ao carrinho.`);
        closeModal();
      });
    }
  }
}

/* ===== Filtros ===== */
let filteredProducts = [...PRODUCTS];
function applyFilters() {
  const term = searchEl.value.trim().toLowerCase();
  const cat = catFilterEl.value;
  const sortVal = sortEl.value;

  filteredProducts = PRODUCTS.filter(p => {
    const matchesTerm = p.name.toLowerCase().includes(term);
    const matchesCat = cat ? p.category === cat : true;
    return matchesTerm && matchesCat;
  });

  if (sortVal) {
    if (sortVal === 'price-asc') filteredProducts.sort((a,b)=>a.price-b.price);
    if (sortVal === 'price-desc') filteredProducts.sort((a,b)=>b.price-a.price);
    if (sortVal === 'name-asc') filteredProducts.sort((a,b)=>a.name.localeCompare(b.name));
  }

  renderCatalog(filteredProducts);
}

/* ===== Modal produto ===== */
function openProductModal(id) {
  const p = PRODUCTS.find(x => x.id === id);
  if (!p) return;
  q('#modalTitle').textContent = p.name;
  q('#modalDesc').textContent = p.description;
  q('#modalPrice').textContent = formatCurrency(p.price);
  q('#addToCartFromModal').dataset.id = p.id;
  q('#modalGallery').innerHTML = p.images.map(src => `<img src="${src}" alt="${p.name}" />`).join('');
  q('#productModal').setAttribute('aria-hidden', 'false');
}
function closeModal() {
  q('#productModal').setAttribute('aria-hidden', 'true');
}

/* ===== UI do Carrinho ===== */
function updateCartUI() {
  const cartCountEl = q('#cart-count');
  if (cartCountEl) {
    const count = cart.items.reduce((s,i)=> s + i.qty, 0);
    cartCountEl.textContent = count;
  }
  if (!cartItemsEl) return;

  cartItemsEl.innerHTML = '';
  if (cart.items.length === 0) {
    cartItemsEl.textContent = 'Carrinho vazio.';
  } else {
    cart.items.forEach(i => {
      const el = document.createElement('div');
      el.innerHTML = `
        <div style="display:flex;align-items:center;gap:.5rem;">
          <img src="${i.image}" alt="${i.name}" style="width:40px;height:40px;object-fit:contain;">
          <div>
            <strong>${i.name}</strong>
            <p>${formatCurrency(i.price)}</p>
          </div>
        </div>
        <div>
          <input class="item-qty" type="number" min="1" value="${i.qty}" data-id="${i.id}" />
          <button class="remove-item btn-secondary" data-id="${i.id}" aria-label="Remover ${i.name}">Remover</button>
        </div>
      `;
      cartItemsEl.appendChild(el);
    });
  }

  const subtotal = cart.subtotal();
  if (cartSubtotalEl) cartSubtotalEl.textContent = formatCurrency(subtotal);

  // recalcula frete e total se já há CEP preenchido
  const cepDigits = cepInput?.value.replace(/\D/g,'') || '';
  if (cepDigits.length === 8) {
    const frete = currentFrete(subtotal);
    if (freteValueEl) freteValueEl.textContent = formatCurrency(frete);
    if (cartTotalEl) cartTotalEl.textContent = formatCurrency(subtotal + frete);
  } else {
    if (freteValueEl) freteValueEl.textContent = formatCurrency(0);
    if (cartTotalEl) cartTotalEl.textContent = formatCurrency(subtotal);
  }
}

/* ===== Toggle carrinho ===== */
function toggleCart(show) {
  const cartPanel = q('#cartPanel');
  const overlay = q('.cart-overlay');
  if (!cartPanel) return;

  // Gerencia o overlay
  if (!overlay) {
    const newOverlay = document.createElement('div');
    newOverlay.className = 'cart-overlay';
    document.body.appendChild(newOverlay);
    newOverlay.addEventListener('click', () => toggleCart(false));
  }

  // Toggle das classes e atributos
  cartPanel.setAttribute('aria-hidden', String(!show));
  q('.cart-overlay')?.classList.toggle('active', show);
  document.body.style.overflow = show ? 'hidden' : '';

  // Gerenciamento de foco
  if (show) {
    cartPanel.focus();
    // Guarda o último elemento focado
    window.lastFocusedElement = document.activeElement;
    
    // Trap focus dentro do carrinho
    const focusableElements = qa('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', cartPanel);
    const firstFocusableElement = focusableElements[0];
    const lastFocusableElement = focusableElements[focusableElements.length - 1];

    cartPanel.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        toggleCart(false);
        return;
      }
      
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstFocusableElement) {
            lastFocusableElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastFocusableElement) {
            firstFocusableElement.focus();
            e.preventDefault();
          }
        }
      }
    });
  } else {
    // Retorna o foco ao elemento anterior
    window.lastFocusedElement?.focus();
  }
}

/* ===== Frete ===== */
function currentFrete(subtotal) {
  return subtotal >= 500 ? 0 : 20;
}

/* ===== CEP (ViaCEP) ===== */
function onCepInput(e) {
  let v = e.target.value.replace(/\D/g,'');
  if (v.length > 8) v = v.slice(0,8);
  if (v.length > 5) v = v.slice(0,5) + '-' + v.slice(5);
  e.target.value = v;
  const digits = v.replace(/\D/g,'');
  cepHelp.textContent = '';
  if (digits.length === 8) fetchCep(digits);
}

async function fetchCep(cep) {
  cepHelp.textContent = 'Buscando endereço...';
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    if (!res.ok) throw new Error('Falha na requisição');
    const data = await res.json();
    if (data.erro) {
      cepHelp.textContent = 'CEP não encontrado. Preencha manualmente.';
    } else {
      q('#street').value = data.logradouro || '';
      q('#neighborhood').value = data.bairro || '';
      q('#city').value = data.localidade || '';
      q('#uf').value = data.uf || '';
      cepHelp.textContent = 'Endereço preenchido automaticamente.';

      // calcula frete após CEP válido
      const subtotal = cart.subtotal();
      const frete = currentFrete(subtotal);
      freteValueEl.textContent = formatCurrency(frete);
      cartTotalEl.textContent = formatCurrency(subtotal + frete);
    }
  } catch (err) {
    cepHelp.textContent = 'Erro ao buscar CEP. Preencha manualmente.';
  }
}

/* ===== Toast ===== */
function showToast(message, type = 'success') {
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

/* Expose */
window.app = { cart, PRODUCTS };
