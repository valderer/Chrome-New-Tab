const leftDesktop = document.getElementById('leftDesktop');
const rightDesktop = document.getElementById('rightDesktop');
const rightHeader = document.getElementById('rightHeader');

const modal = document.getElementById('addModal');
const modalTitle = document.getElementById('modalTitle');
const siteNameInput = document.getElementById('siteName');
const siteUrlInput = document.getElementById('siteUrl');
const cancelBtn = document.getElementById('cancelBtn');
const saveBtn = document.getElementById('saveBtn');

// 编辑弹窗
const editModal = document.getElementById('editModal');
const editSiteNameInput = document.getElementById('editSiteName');
const editSiteUrlInput = document.getElementById('editSiteUrl');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const saveEditBtn = document.getElementById('saveEditBtn');
const deleteEditBtn = document.getElementById('deleteEditBtn');
let currentEditAppId = null;
let currentEditAppIsFolder = false;

// 注入设置面板与主题切换功能
let isEditMode = false;

function initSettings() {
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsPanel = document.getElementById('settingsPanel');
    
    // 打开/关闭设置面板
    settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        settingsPanel.classList.toggle('active');
        settingsBtn.classList.toggle('active');
    });

    // --- 新增：编辑模式切换逻辑 ---
    const editBtns = document.querySelectorAll('.edit-btn');
    editBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.edit; // 'on' or 'off'
            isEditMode = (mode === 'on');
            
            // UI
            editBtns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            
            if (isEditMode) {
                document.body.classList.add('edit-mode');
            } else {
                document.body.classList.remove('edit-mode');
            }
        });
    });

    // 点击空白处关闭设置面板
    document.addEventListener('click', (e) => {
        if (!settingsPanel.contains(e.target) && !settingsBtn.contains(e.target) && !e.target.closest('#editModal') && !e.target.closest('#addModal') && !e.target.closest('.app-icon')) {
            settingsPanel.classList.remove('active');
            settingsBtn.classList.remove('active');
        }
    });

    // --- 1. 深浅模式切换逻辑 ---
    const savedMode = localStorage.getItem('apple_mode') || 'auto';
    updateCurrentMode(savedMode, false); // 避免重复触发改动

    const modeBtns = document.querySelectorAll('.mode-btn');
    modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.mode;
            localStorage.setItem('apple_mode', mode);
            updateCurrentMode(mode, true);
        });
    });

    // --- 2. 主题色彩切换逻辑 ---
    const savedColor = localStorage.getItem('apple_color') || 'aurora';
    updateCurrentColor(savedColor);

    const colorBtns = document.querySelectorAll('.color-btn');
    colorBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const color = btn.dataset.color;
            localStorage.setItem('apple_color', color);
            updateCurrentColor(color);
        });
    });
}

// 辅助方法：更新模式
function updateCurrentMode(modeOption, applyToDoc = true) {
    // 改变按钮选中状态
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.mode === modeOption);
    });
    
    if (applyToDoc) {
        let activeMode = modeOption;
        if (modeOption === 'auto') {
            activeMode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        document.documentElement.setAttribute('data-mode', activeMode);
    }
}

// 辅助方法：更新颜色
function updateCurrentColor(colorOption) {
    // 改变按钮选中状态
    document.querySelectorAll('.color-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.color === colorOption);
    });
    document.documentElement.setAttribute('data-color', colorOption);
}

// 监听系统深浅模式的实时变化
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    const currentOption = localStorage.getItem('apple_mode') || 'auto';
    if (currentOption === 'auto') {
        const activeMode = e.matches ? 'dark' : 'light';
        document.documentElement.setAttribute('data-mode', activeMode);
    }
});

initSettings(); // 页面加载拉取配置

let rootFolderId = "1"; // 默认起始文件夹("1"通常指书签栏)
let currentHoveredFolderId = null; // 当前右侧展示的文件夹ID
let hoverTimer = null; // 悬停延迟计时器
let isAddingToLeft = true; // 记录是在哪一边点击了"添加"按钮

// 获取网站图标 (改用 Chrome 最新原生高速本地 API，无缝读取存盘 Icon)
function getFavicon(urlStr) {
    if (chrome && chrome.runtime && chrome.runtime.getURL) {
        try {
            const urlObj = new URL(chrome.runtime.getURL("/_favicon/"));
            urlObj.searchParams.set("pageUrl", urlStr);
            urlObj.searchParams.set("size", "64");
            return urlObj.toString();
        } catch (e) {
            return '';
        }
    }
    return '';
}

// 统一生成图标DOM的工厂函数
// app:书签项  containerType: 'left' 或 'right'
function createAppElement(app, containerType) {
    const isFolder = !app.url; // url 不存在则为文件夹
    // 【修改】统一改为 <div> 标签，以防止 a 标签干扰拖拽与点击拦截
    const appEl = document.createElement('div');
    appEl.className = 'app-icon';
    appEl.title = app.title;
    
    // 我们给所有的图标存入id标记
    appEl.dataset.id = app.id;
    appEl.dataset.parentId = app.parentId || rootFolderId;

    if (isFolder) {
        // ============ 文件夹 UI (Apple Mac 风格文件夹) ============
        appEl.innerHTML = `
            <div class="icon-img">
                <svg viewBox="0 0 24 24" fill="var(--btn-primary, #3478F6)" style="width:100%;height:100%; transition: fill 0.8s ease;">
                    <path d="M10.4 4.5l1.6 2.5H20c1.1 0 2 .9 2 2v9c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6.5c0-1.1.9-2 2-2h6.4z" />
                </svg>
            </div>
            <span class="app-title"></span>
        `;
        const titleSpan = appEl.querySelector('.app-title');
        titleSpan.textContent = app.title; // 防XSS及避免在内联HTML中注入不可预期字符
        
        // 关键交互：左侧面板鼠标悬停 -> 延迟后刷新右侧面板（非编辑模式下生效，或者即使编辑模式也需要加载子集）
        if (containerType === 'left') {
            appEl.addEventListener('mouseenter', () => {
                if (currentHoveredFolderId !== app.id) {
                    loadRightPanel(app.id, app.title);
                    updateLeftActiveState(app.id);
                }
            });
        }

        // 曾经这里的 deleteBtn 现已不需要，移入了编辑模式的小窗口中
    } else {
        // ============ 书签 UI (极速加载 + Apple占位符) ============
        // 采用精致的 Apple Safari 风格“地球(Globe)”网络图标作为统一默认底图
        const defaultGlobeSVG = `data:image/svg+xml;utf8,<svg viewBox='0 0 24 24' fill='none' stroke='%238e8e93' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' xmlns='http://www.w3.org/2000/svg'><circle cx='12' cy='12' r='10'></circle><path d='M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z'></path><path d='M2 12h20'></path></svg>`;
        
        // 如果提取不到图标，默认用一个非常现代的柔和小方块 + 字母代替 (Apple灰)
        const firstLetter = app.title ? app.title.charAt(0).toUpperCase() : '?';
        const fallbackSVG = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><rect fill='%23f2f2f7' width='64' height='64' rx='16'/><text fill='%238e8e93' x='50%' y='50%' font-family='-apple-system, sans-serif' font-size='32' font-weight='500' text-anchor='middle' dy='11'>${firstLetter}</text></svg>`;
        
        appEl.innerHTML = `
            <div class="icon-img" style="overflow: hidden;">
                <img src="" alt="Icon" class="bookmark-icon">
            </div>
            <span class="app-title"></span>
        `;
        
        const titleSpan = appEl.querySelector('.app-title');
        titleSpan.textContent = app.title; // 防XSS

        const iconNode = appEl.querySelector('.bookmark-icon');
        iconNode.alt = app.title;
        // 预设默认头像
        iconNode.src = defaultGlobeSVG;

        // 异步静默替换：去 Chrome 本地缓存拉取
        const faviconUrl = getFavicon(app.url);
        if (faviconUrl) {
            const img = new Image();
            img.onload = () => {
                if (iconNode && img.width > 0) {
                    iconNode.src = faviconUrl;
                }
            };
            // 失败时也保留预设图标，故不需onerror
            img.src = faviconUrl;
        }

        // 曾经这里的 deleteBtn 现已不需要，移入了编辑模式的小窗口中
    }
    
    // 【新】拖拽 & 统一点击事件
    setupAppIconInteraction(appEl, app, isFolder, containerType);

    return appEl;
}

// 统一事件注册中心：处理点击阻断、编辑弹窗和拖拽排序
function setupAppIconInteraction(appEl, app, isFolder, containerType) {
    // 1. 点击事件分发
    appEl.addEventListener('click', (e) => {
        if (e.target.closest('.delete-btn')) return; // 被删除按钮拦截
        
        if (isEditMode) {
            e.preventDefault();
            // 在编辑模式下，点击打开编辑面板
            openEditModal(app);
            return;
        }

        // 非编辑模式，正常行为：书签跳转
        if (!isFolder && app.url) {
            window.open(app.url, '_blank');
        } else if (isFolder && containerType === 'right') {
            loadRightPanel(app.id, app.title);
            updateLeftActiveState(app.id); // 保证左侧高亮状态同步（嵌套深层会取消左侧高亮）
        }
    });

    // 2. 拖拽核心逻辑（仅当开启编辑模式时才激活拖拽特征）
    appEl.draggable = true;

    appEl.addEventListener('dragstart', (e) => {
        if (!isEditMode) {
            e.preventDefault();
            return;
        }
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('source-book-id', app.id);
        e.dataTransfer.setData('source-parent-id', appEl.dataset.parentId);
        
        // 使用 timeout 让浏览器先抓取原生 ghost image 然后再变透明，防止拖拽残影消失
        setTimeout(() => {
            appEl.classList.add('dragging');
        }, 0);
    });

    appEl.addEventListener('dragend', () => {
        appEl.classList.remove('dragging');
        document.querySelectorAll('.app-icon').forEach(el => el.classList.remove('drag-over', 'drag-into-folder'));
        
        // 【核心推挤】：如果拖拽是在当前容器内部完成了同级 DOM 节点物理倒换，去触发 Chrome Bookmarks API 同步最新顺序
        const container = appEl.parentNode;
        if (!container || appEl.dataset.newParentId) return; // 如果已经进入新目录被 drop 接管，则跳过同级重排同步
        
        const siblings = Array.from(container.querySelectorAll('.app-icon:not(.add-action):not(.home-action):not(.back-action)'));
        const newIndex = siblings.indexOf(appEl);
        
        if (newIndex !== -1 && appEl.dataset.parentId && chrome && chrome.bookmarks) {
            chrome.bookmarks.move(app.id, {
                parentId: appEl.dataset.parentId,
                index: newIndex
            });
        }
    });

    appEl.addEventListener('dragover', (e) => {
        if (!isEditMode) return;
        e.preventDefault(); 
        
        const dragging = document.querySelector('.dragging');
        if (!dragging || dragging === appEl) return;
        
        const rect = appEl.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        
        // 如果是文件夹，鼠标悬停在中间 50% 的区域则视为"放入文件夹内部"，否则视为"推挤排序"
        if (isFolder && mouseX > rect.width * 0.25 && mouseX < rect.width * 0.75) {
            appEl.classList.add('drag-into-folder');
            appEl.classList.remove('drag-over');
            return; 
        } else {
            appEl.classList.remove('drag-into-folder');
        }

        // 推挤重排（仅限当前容器内的项目同级"推挤"）
        if (dragging.dataset.parentId === appEl.dataset.parentId) {
            const container = appEl.parentNode;
            const siblings = Array.from(container.querySelectorAll('.app-icon:not(.add-action):not(.home-action):not(.back-action)'));
            const draggingIndex = siblings.indexOf(dragging);
            const targetIndex = siblings.indexOf(appEl);
            
            // 计算前后位置进行真实 DOM 的推挤
            if (draggingIndex < targetIndex) {
                 container.insertBefore(dragging, appEl.nextSibling);
            } else {
                 container.insertBefore(dragging, appEl);
            }
        } else {
            // 如果是跨板拖入对应邻居位置，仅高亮显示暗示落点
            appEl.classList.add('drag-over');
        }
    });

    appEl.addEventListener('dragleave', () => {
        if (!isEditMode) return;
        appEl.classList.remove('drag-over', 'drag-into-folder');
    });

    appEl.addEventListener('drop', (e) => {
        if (!isEditMode) return;
        e.preventDefault();
        
        const isIntoFolder = appEl.classList.contains('drag-into-folder');
        appEl.classList.remove('drag-over', 'drag-into-folder');
        
        const sourceId = e.dataTransfer.getData('source-book-id');
        const targetId = app.id;
        if (sourceId === targetId) return;

        const dragging = document.querySelector('.dragging');

        if (chrome && chrome.bookmarks) {
            if (isIntoFolder && isFolder) {
                // 彻底放入目标文件夹的节点里
                if (dragging) dragging.dataset.newParentId = targetId; 
                chrome.bookmarks.move(sourceId, {
                    parentId: targetId
                });
            } else if (dragging && dragging.dataset.parentId !== appEl.dataset.parentId) {
                // 跨目录跨容器拖拽插入邻居位置
                dragging.dataset.newParentId = appEl.dataset.parentId; 
                chrome.bookmarks.get(targetId, (targetNodes) => {
                    if (targetNodes.length > 0) {
                        const targetNode = targetNodes[0];
                        chrome.bookmarks.move(sourceId, {
                            parentId: targetNode.parentId,
                            index: targetNode.index
                        });
                    }
                });
            }
        }
    });
}

// 获取已在 HTML 中写死的固定的首页按钮，并绑定事件
const homeBtnTop = document.getElementById('homeBtnTop');
if (homeBtnTop) {
    homeBtnTop.addEventListener('mouseenter', () => {
        if (currentHoveredFolderId !== 'HOME') {
            loadSearchPane();
            updateLeftActiveState('HOME');
        }
    });
}

// 刷新左侧被选中的文件夹高亮效果
function updateLeftActiveState(activeId) {
    // 覆盖整个左侧面板，包含固定区域和滚动区域
    const allLeftIcons = document.querySelectorAll('.left-panel .app-icon');
    let targetIcon = null;
    allLeftIcons.forEach(icon => {
        if (icon.dataset.id === activeId) {
            icon.classList.add('active'); // 逻辑上的 active
            targetIcon = icon;
        } else {
            icon.classList.remove('active');
        }
    });
    
    if (targetIcon) {
        updateHighlightPosition(targetIcon);
    }
}

// 动态创建滑动光标
let highlightPill = document.getElementById('activeHighlightPill');
if (!highlightPill) {
    highlightPill = document.createElement('div');
    highlightPill.id = 'activeHighlightPill';
    const leftPanel = document.querySelector('.left-panel');
    if (leftPanel) leftPanel.appendChild(highlightPill);
}

function updateHighlightPosition(targetIcon) {
    if (!highlightPill || !targetIcon) return;
    const panel = document.querySelector('.left-panel');
    if (!panel) return;
    
    // 如果不在视口内或被 display:none 等隐藏了，宽度高度会为 0
    const panelRect = panel.getBoundingClientRect();
    const iconRect = targetIcon.getBoundingClientRect();
    
    if (iconRect.width === 0) return;
    
    // 计算相对于 panel 的位置
    // 由于 iconRect 是相对于视口的，panelRect 也是相对于视口的，所以相减就是 relative position 
    highlightPill.style.transform = `translateY(${Math.max(0, iconRect.top - panelRect.top)}px)`;
    highlightPill.style.height = `${iconRect.height}px`;
    highlightPill.style.width = `${iconRect.width}px`;
    highlightPill.style.left = `${iconRect.left - panelRect.left}px`;
    highlightPill.style.opacity = '1';
}

// 当左侧滚动时，实时更新光标位置，使其死死咬住目标
const leftDesktopNode = document.getElementById('leftDesktop');
if (leftDesktopNode) {
    let scrollTimeout;
    leftDesktopNode.addEventListener('scroll', () => {
        // 滚动时关闭过渡动画以防延迟拖尾
        if (highlightPill) {
            highlightPill.style.transition = 'none';
        }
        
        const activeIcon = document.querySelector('.left-panel .app-icon.active');
        if (activeIcon) {
            updateHighlightPosition(activeIcon);
        }
        
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            if (highlightPill) {
                highlightPill.style.transition = 'transform 0.25s cubic-bezier(0.25, 1, 0.5, 1), height 0.25s, width 0.25s, opacity 0.2s';
            }
        }, 100);
    });
}

// 窗口尺寸改变时也要重算高亮罩位置
window.addEventListener('resize', () => {
    const activeIcon = document.querySelector('.left-panel .app-icon.active');
    if (activeIcon) {
        if (highlightPill) highlightPill.style.transition = 'none';
        updateHighlightPosition(activeIcon);
        setTimeout(() => {
            if (highlightPill) highlightPill.style.transition = '';
        }, 50);
    }
});


// 初始化/刷新整体视图
function loadAll() {
    if (chrome && chrome.bookmarks) {
        // 读取主目录 (左侧)
        chrome.bookmarks.getChildren(rootFolderId, (children) => {
            let leftChildren = children;
            let quickAccessFolder = null;
            
            // 提取第一个文件夹作为快速访问目录（首页）
            const firstFolderIndex = children.findIndex(c => !c.url);
            if (firstFolderIndex !== -1) {
                quickAccessFolder = children[firstFolderIndex];
                leftChildren = children.slice();
                leftChildren.splice(firstFolderIndex, 1);
            }

            renderLeftPanel(leftChildren);

            if (quickAccessFolder) {
                chrome.bookmarks.getChildren(quickAccessFolder.id, (qaChildren) => {
                    renderQuickAccess(qaChildren, quickAccessFolder.id);
                });
            }

            // 默认判断：如果以前悬停过某个文件夹，那就继续展示它；如果没有，默认寻找剩下的第一个文件夹进行展示
            if (currentHoveredFolderId && currentHoveredFolderId !== (quickAccessFolder ? quickAccessFolder.id : null)) {
                // 检查该文件夹是否被删了
                const stillExists = leftChildren.find(c => c.id === currentHoveredFolderId && !c.url);
                if (stillExists) {
                    // 如果存在，并且不在搜索首页面板中（如果是首页则保持搜索屏）
                    if (document.getElementById('searchContainer') && document.getElementById('searchContainer').style.display === 'flex') {
                        // 正在看首页，不用载入右面板
                    } else {
                        loadRightPanel(stillExists.id, stillExists.title);
                        updateLeftActiveState(stillExists.id);
                    }
                } else {
                    selectDefaultRightPanel(leftChildren);
                }
            } else if (currentHoveredFolderId && currentHoveredFolderId === 'HOME') {
                // 已经处于首页状态，可以略过
            } else {
                selectDefaultRightPanel(leftChildren);
            }
        });
    } else {
        // 本地调试的临时数据
        const mockData = [
            { id: "dir1", title: "工作资料 (试hover)" },
            { id: "dir2", title: "娱乐摸鱼 (试hover)" },
            { id: "file1", title: "Google", url: "https://google.com" }
        ];
        renderLeftPanel(mockData);
        rightHeader.textContent = "本地调试模式";
        rightDesktop.innerHTML = "<div style='color:white;grid-column:1/-1'>请将扩展程序挂载至Chrome后体验完整效果～</div>";
    }
}

// 帮助函数：从左侧列表里找到第一个文件夹，或者默认展示首页全屏搜索
function selectDefaultRightPanel(leftChildren) {
    // 改为默认展示首页大搜索框
    loadSearchPane();
    // 使用一个轻微的延时以确保DOM渲染完毕再去挂高亮样式
    setTimeout(() => updateLeftActiveState('HOME'), 50);
}

// 独立加载搜索页面的逻辑
function loadSearchPane() {
    currentHoveredFolderId = 'HOME';
    rightHeader.textContent = "首页";
    rightHeader.style.display = 'none'; // 首页隐藏 header
    document.getElementById('rightDesktop').style.display = 'none';

    const searchContainer = document.getElementById('searchContainer');
    if (searchContainer) {
        searchContainer.style.display = 'flex';
        // 使用延时自动聚焦，避免被其他渲染线程或动画阻断
        setTimeout(() => { document.getElementById('searchInput').focus(); }, 150);
    }
}

// 渲染左侧面板里的应用
function renderLeftPanel(items) {
    leftDesktop.innerHTML = '';
    
    items.forEach((app) => {
        const appEl = createAppElement(app, 'left');
        leftDesktop.appendChild(appEl);
    });

    // 左侧新建按钮：用于往主分类建文件夹或书签
    const addBtn = document.createElement('div');
    addBtn.className = 'app-icon add-action';
    addBtn.innerHTML = `
        <div class="icon-img">
            <svg viewBox="0 0 24 24" fill="currentColor" style="width:100%;height:100%;"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
        </div>
        <span class="app-title">新建内容</span>
    `;
    addBtn.addEventListener('click', () => openModal(true));
    leftDesktop.appendChild(addBtn);
}

// 根据给定的文件夹ID加载它的子节点放入右侧面板
function loadRightPanel(folderId, folderTitle) {
    currentHoveredFolderId = folderId;
    rightHeader.textContent = folderTitle || "子内容";
    rightHeader.style.display = 'block'; // 进入文件夹时显示 header

    // 给 header 加上非常轻微的呼吸感
    rightHeader.style.opacity = '0';
    rightHeader.style.transform = 'translateY(4px)';
    rightHeader.style.transition = 'none';
    setTimeout(() => {
        rightHeader.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
        rightHeader.style.opacity = '1';
        rightHeader.style.transform = 'translateY(0)';
    }, 10);
    
    // 显示对应的网格，隐藏搜索栏
    document.getElementById('rightDesktop').style.display = ''; 
    const searchContainer = document.getElementById('searchContainer');
    if (searchContainer) searchContainer.style.display = 'none';

    if (chrome && chrome.bookmarks) {
        chrome.bookmarks.get(folderId, (nodes) => {
            const currentFolder = nodes ? nodes[0] : null;
            chrome.bookmarks.getChildren(folderId, (children) => {
                renderRightPanel(children, folderId, currentFolder);
            });
        });
    }
}

// 渲染首页快速访问链接（从第一个收藏夹中获取）
function renderQuickAccess(items, folderId) {
    const quickAccessDesktop = document.getElementById('quickAccessDesktop');
    if (!quickAccessDesktop) return;
    
    quickAccessDesktop.innerHTML = '';
    
    // 复用子项目的飞入效果类和脉冲
    quickAccessDesktop.classList.remove('right-panel-content-area');
    void quickAccessDesktop.offsetWidth; 
    quickAccessDesktop.classList.add('right-panel-content-area');

    let delayCounter = 0;

    items.forEach((app) => {
        // 使用 'right' 作为 containerType，因为我们要右侧面板同样的行为（点击能打开/内入）
        const appEl = createAppElement(app, 'right');
        appEl.style.animationDelay = `${Math.min(delayCounter * 18, 150)}ms`;
        quickAccessDesktop.appendChild(appEl);
        delayCounter++;
    });

    // 为首页增加一个快速添加按钮
    const addBtn = document.createElement('div');
    addBtn.className = 'app-icon add-action';
    addBtn.style.animationDelay = `${Math.min(delayCounter * 18, 150)}ms`;
    // 为了能够在该文件夹中添加，临时借用一个变量或直接触发回调
    addBtn.innerHTML = `
        <div class="icon-img">
            <svg viewBox="0 0 24 24" fill="currentColor" style="width:100%;height:100%;"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
        </div>
        <span class="app-title">添加快捷</span>
    `;
    addBtn.addEventListener('click', () => {
        // 重定向 Hover ID
        currentHoveredFolderId = folderId; 
        openModal(false);
    });
    quickAccessDesktop.appendChild(addBtn);
}

// 渲染右侧面板（此时一般显示的是被选中的文件夹的内部书签）
function renderRightPanel(items, folderId, currentFolder) {
    rightDesktop.innerHTML = '';
    
    // 给右侧桌面自身增加一个小脉冲防止僵硬重排
    rightDesktop.classList.remove('right-panel-content-area');
    void rightDesktop.offsetWidth; // 触发回流(Reflow)，重置动画
    rightDesktop.classList.add('right-panel-content-area');
    
    // 设置项目逐渐浮现 (stagger effect)
    let delayCounter = 0;

    // 如果当前处于深层嵌套文件夹（非首层），渲染一个“返回上级”的按钮
    if (currentFolder && currentFolder.parentId && currentFolder.parentId !== rootFolderId && currentFolder.parentId !== "0") {
        const backBtn = document.createElement('div');
        backBtn.className = 'app-icon back-action';
        backBtn.style.animationDelay = `${Math.min(delayCounter * 18, 150)}ms`;
        backBtn.innerHTML = `
            <div class="icon-img">
                <svg viewBox="0 0 24 24" fill="var(--btn-primary, #3478F6)" style="width:100%;height:100%; transition: fill 0.8s ease;">
                    <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
                </svg>
            </div>
            <span class="app-title">返回上级</span>
        `;
        backBtn.addEventListener('click', () => {
            if (chrome && chrome.bookmarks) {
                chrome.bookmarks.get(currentFolder.parentId, (parentNodes) => {
                    if (parentNodes && parentNodes.length > 0) {
                        const pNode = parentNodes[0];
                        loadRightPanel(pNode.id, pNode.title);
                        updateLeftActiveState(pNode.id);
                    }
                });
            }
        });
        rightDesktop.appendChild(backBtn);
        delayCounter++;
    }

    items.forEach((app) => {
        const appEl = createAppElement(app, 'right');
        // 为每一个小碎片加上交错延迟 (最多延迟不超150ms，保持敏捷感)
        appEl.style.animationDelay = `${Math.min(delayCounter * 18, 240)}ms`;
        rightDesktop.appendChild(appEl);
        delayCounter++;
    });

    // 右侧的添加按钮：用于往当前查阅的文件夹里增加书签
    const addBtn = document.createElement('div');
    addBtn.className = 'app-icon add-action';
    addBtn.style.animationDelay = `${Math.min(delayCounter * 18, 150)}ms`;
    addBtn.innerHTML = `
        <div class="icon-img">
            <svg viewBox="0 0 24 24" fill="currentColor" style="width:100%;height:100%;"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
        </div>
        <span class="app-title">添加书签</span>
    `;
    addBtn.addEventListener('click', () => openModal(false));
    rightDesktop.appendChild(addBtn);
}

// 删除应用或整个文件夹
function deleteApp(id, isFolder) {
    const msg = isFolder ? '⚠️ 注意：确定要删除这个文件夹以及里面的所有内容吗？' : '确定要删除这个书签吗？';
    if (confirm(msg)) {
        if (chrome && chrome.bookmarks) {
            if (isFolder) {
                chrome.bookmarks.removeTree(id); // 支持删除带子节点的文件夹树
            } else {
                chrome.bookmarks.remove(id);
            }
            // 无论是remove还是removeTree，都会触发chrome.bookmarks的事件，自动重载列表
        }
    }
}

// 弹窗打开
function openModal(toLeft) {
    isAddingToLeft = toLeft;
    siteNameInput.value = '';
    siteUrlInput.value = '';
    
    if (toLeft) {
        modalTitle.textContent = "在主目录新建";
    } else {
        const rightLabelNode = document.getElementById('rightHeader');
        modalTitle.textContent = "增加到：" + rightLabelNode.innerText;
    }
    
    modal.classList.add('active');
    siteNameInput.focus();
}

// 弹窗关闭
function closeModal() {
    modal.classList.remove('active');
    if(editModal) editModal.classList.remove('active');
}

// 打开编辑弹窗
function openEditModal(app) {
    currentEditAppId = app.id;
    currentEditAppIsFolder = !app.url;
    
    editSiteNameInput.value = app.title || '';
    editSiteUrlInput.value = app.url || '';
    
    // 如果是文件夹，不可编辑URL
    if (currentEditAppIsFolder) {
        editSiteUrlInput.style.display = 'none';
        deleteEditBtn.style.display = 'block'; // 允许强制删除整个文件夹？如果是空的话最好，但这里允许用户强制删除
    } else {
        editSiteUrlInput.style.display = 'block';
        deleteEditBtn.style.display = 'block';
    }
    
    editModal.classList.add('active');
    editSiteNameInput.focus();
}

// 保存编辑
function saveEditSite() {
    if (!currentEditAppId) return;
    
    const title = editSiteNameInput.value.trim();
    let url = editSiteUrlInput.value.trim();
    
    if (!title) {
        alert('名称不能为空！');
        return;
    }
    
    if (chrome && chrome.bookmarks) {
        const changes = { title: title };
        if (!currentEditAppIsFolder && url) {
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                url = 'https://' + url;
            }
            changes.url = url;
        }
        chrome.bookmarks.update(currentEditAppId, changes, () => {
            closeModal();
        });
    } else {
        closeModal();
    }
}

// 删除（从编辑面板）
function deleteFromEdit() {
    if (!currentEditAppId) return;
    deleteApp(currentEditAppId, currentEditAppIsFolder);
    closeModal();
}


// 处理“保存”请求（包含判断是要创建文件夹还是创建书签）
function addNewSite() {
    const title = siteNameInput.value.trim();
    let url = siteUrlInput.value.trim();
    
    if (!title) {
        alert('你至少得写个名称呀！！');
        return;
    }
    
    // 有链接且没有前缀的话，自动套一个 HTTPS
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }
    
    // 判断我们当下是在为哪一层级创建内容：
    // 是点左边的+号还是右边文件夹内部的+号
    const targetParentId = isAddingToLeft ? rootFolderId : (currentHoveredFolderId || rootFolderId);
    
    if (chrome && chrome.bookmarks) {
        const bookmarkObj = {
            parentId: targetParentId,
            title: title
        };
        // 如果 url 不为空，代表创建书签；如果 url 为空，代表创建普通的文件夹。
        if (url) {
            bookmarkObj.url = url;
        }
        chrome.bookmarks.create(bookmarkObj);
    }
    
    closeModal();
}

// 核心：监听 Chrome 书签环境的任何变动，一旦发现增删改挪，马上重绘界面！
if (chrome && chrome.bookmarks) {
    chrome.bookmarks.onCreated.addListener(loadAll);
    chrome.bookmarks.onRemoved.addListener(loadAll);
    chrome.bookmarks.onChanged.addListener(loadAll);
    chrome.bookmarks.onMoved.addListener(loadAll);
}

// 各类事件初始化
cancelBtn.addEventListener('click', closeModal);
saveBtn.addEventListener('click', addNewSite);
modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        closeModal();
    }
});

// 编辑功能事件
if (cancelEditBtn) cancelEditBtn.addEventListener('click', closeModal);
if (saveEditBtn) saveEditBtn.addEventListener('click', saveEditSite);
if (deleteEditBtn) deleteEditBtn.addEventListener('click', deleteFromEdit);
if (editModal) {
    editModal.addEventListener('click', (e) => {
        if (e.target === editModal) closeModal();
    });
}
if (editSiteNameInput) {
    editSiteNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') saveEditSite();
    });
}
if (editSiteUrlInput) {
    editSiteUrlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') saveEditSite();
    });
}

// 支持按回车键响应保存
siteUrlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addNewSite();
});
siteNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addNewSite();
});

// ================== 科幻块状方块时钟 ==================
const DIGIT_MATRIX = {
    '0': [1,1,1, 1,0,1, 1,0,1, 1,0,1, 1,1,1],
    '1': [0,0,1, 0,1,1, 0,0,1, 0,0,1, 0,0,1],
    '2': [1,1,1, 0,0,1, 1,1,1, 1,0,0, 1,1,1],
    '3': [1,1,1, 0,0,1, 1,1,1, 0,0,1, 1,1,1],
    '4': [1,0,1, 1,0,1, 1,1,1, 0,0,1, 0,0,1],
    '5': [1,1,1, 1,0,0, 1,1,1, 0,0,1, 1,1,1],
    '6': [1,1,1, 1,0,0, 1,1,1, 1,0,1, 1,1,1],
    '7': [1,1,1, 0,0,1, 0,0,1, 0,0,1, 0,0,1],
    '8': [1,1,1, 1,0,1, 1,1,1, 1,0,1, 1,1,1],
    '9': [1,1,1, 1,0,1, 1,1,1, 0,0,1, 1,1,1]
};

let lastTimeStr = "";

// 构建 DOM 矩阵
function initMatrixClock(clockEl) {
    clockEl.innerHTML = '';
    for (let i = 0; i < 6; i++) { // 6位数: 时、分、秒
        const digitEl = document.createElement('div');
        digitEl.className = 'scifi-digit';
        for (let j = 0; j < 15; j++) {
            const block = document.createElement('div');
            block.className = 'scifi-block';
            // 随机分配一点延时，让方块像机械碎片一样散落和重组
            block.style.transitionDelay = `${(Math.random() * 0.4).toFixed(2)}s`;
            digitEl.appendChild(block);
        }
        clockEl.appendChild(digitEl);
    }
}

function updateSciFiClock() {
    const clockEl = document.getElementById('sciFiClock');
    if (!clockEl) return;
    
    if (clockEl.children.length === 0) initMatrixClock(clockEl);

    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    const timeStr = h + m + s;
    
    if (timeStr === lastTimeStr) return; // 如果时间字符串没变，就阻断重绘

    const digits = clockEl.querySelectorAll('.scifi-digit');
    for (let i = 0; i < 6; i++) { // 更新到6位
        // 如果该位数字发生变化，重组对应的矩阵方块
        if (lastTimeStr[i] !== timeStr[i]) {
            const blocks = digits[i].querySelectorAll('.scifi-block');
            const matrix = DIGIT_MATRIX[timeStr[i]] || DIGIT_MATRIX['0'];
            blocks.forEach((block, idx) => {
                if (matrix[idx] === 1) {
                    block.classList.add('active');
                } else {
                    block.classList.remove('active');
                }
            });
        }
    }
    lastTimeStr = timeStr;
}
setInterval(updateSciFiClock, 1000);
updateSciFiClock();

// 发车执行
loadAll();

// ================== 搜索功能事件绑定 ==================
const searchInput = document.getElementById('searchInput');
const engineSelectorBtn = document.getElementById('engineSelectorBtn');
const engineDropdown = document.getElementById('engineDropdown');
const currentEngineIcon = document.getElementById('currentEngineIcon');
const currentEngineName = document.getElementById('currentEngineName');
const searchBoxWrapper = document.querySelector('.search-box-wrapper');

let currentSearchUrl = "https://www.google.com/search?q=";

if (searchBoxWrapper && searchInput) {
    // 细节：鼠标悬停在搜索框区域时自动聚焦，省去点击步骤
    searchBoxWrapper.addEventListener('mouseenter', () => {
        searchInput.focus();
    });
    
    // 点击搜错框外部包裹层也能聚焦
    searchBoxWrapper.addEventListener('click', (e) => {
        if (!e.target.closest('.engine-selector')) {
            searchInput.focus();
        }
    });
}

// 初始化和渲染搜索引擎列表
const defaultEngines = [
    { name: 'Google', url: 'https://www.google.com/search?q=', icon: 'icons/google.ico' },
    { name: 'Bing', url: 'https://www.bing.com/search?q=', icon: 'icons/bing.ico' },
    { name: 'Baidu', url: 'https://www.baidu.com/s?wd=', icon: 'icons/baidu.ico' },
    { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=', icon: 'icons/duckduckgo.ico' },
    { name: 'Bilibili', url: 'https://search.bilibili.com/all?keyword=', icon: 'icons/bilibili.ico' }
];

let searchEngines = JSON.parse(localStorage.getItem('apple_search_engines')) || defaultEngines;
let currentEngineIndex = parseInt(localStorage.getItem('apple_current_engine') || '0', 10);
if (currentEngineIndex >= searchEngines.length) currentEngineIndex = 0;

function renderEngineDropdown() {
    if (!engineDropdown) return;
    engineDropdown.innerHTML = '';

    searchEngines.forEach((engine, index) => {
        const item = document.createElement('div');
        item.className = 'dropdown-item' + (index === currentEngineIndex ? ' active' : '');
        item.dataset.index = index;
        item.dataset.url = engine.url;
        item.dataset.icon = engine.icon;
        
        // 拖拽相关
        item.draggable = true;
        
        item.innerHTML = `
            <img src="${engine.icon}" alt="${engine.name}">
            <span>${engine.name}</span>
            <div class="engine-delete-btn" title="删除" data-index="${index}">×</div>
        `;

        // 拖拽事件监听
        item.addEventListener('dragstart', (e) => {
            if (!isEditMode) { e.preventDefault(); return; }
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('engine-index', index);
            setTimeout(() => item.classList.add('dragging'), 0);
        });
        
        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
            document.querySelectorAll('.dropdown-item').forEach(el => el.style.borderTop = '');
        });
        
        item.addEventListener('dragover', (e) => {
            if (!isEditMode) return;
            e.preventDefault();
            item.style.borderTop = '2px solid var(--btn-primary)';
        });
        
        item.addEventListener('dragleave', () => {
            if (!isEditMode) return;
            item.style.borderTop = '';
        });
        
        item.addEventListener('drop', (e) => {
            if (!isEditMode) return;
            e.preventDefault();
            item.style.borderTop = '';
            const dragIndex = parseInt(e.dataTransfer.getData('engine-index'), 10);
            const dropIndex = index;
            if (dragIndex === dropIndex) return;

            // 调整顺序数组
            const draggedEngine = searchEngines.splice(dragIndex, 1)[0];
            searchEngines.splice(dropIndex, 0, draggedEngine);
            
            // 如果你移动的就是当前选中的项，需要重新定位下标
            if (currentEngineIndex === dragIndex) {
                currentEngineIndex = dropIndex;
            } else if (currentEngineIndex > dragIndex && currentEngineIndex <= dropIndex) {
                currentEngineIndex--;
            } else if (currentEngineIndex < dragIndex && currentEngineIndex >= dropIndex) {
                currentEngineIndex++;
            }
            
            saveEngines();
            renderEngineDropdown();
            updateCurrentEngineUI();
            
            // 保持下拉框在编辑模式托拽后仍然打开
            engineDropdown.classList.add('active');
        });

        // 点击切换引擎
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            if (e.target.classList.contains('engine-delete-btn')) {
                // 删除逻辑
                const delIdx = parseInt(e.target.dataset.index, 10);
                if (searchEngines.length <= 1) {
                    alert('请至少保留一个搜索引擎！');
                    return;
                }
                if (confirm(`确定要删除 ${searchEngines[delIdx].name} 吗？`)) {
                    searchEngines.splice(delIdx, 1);
                    if (currentEngineIndex === delIdx) {
                        currentEngineIndex = 0;
                    } else if (currentEngineIndex > delIdx) {
                        currentEngineIndex--;
                    }
                    saveEngines();
                    renderEngineDropdown();
                    updateCurrentEngineUI();
                    engineDropdown.classList.add('active'); // 删完也开着
                }
                return;
            }

            if (isEditMode) {
                // 编辑模式下点击直接进行编辑
                openEngineModal(index);
                return;
            }

            // 非删除，则应用选中
            currentEngineIndex = index;
            saveEngines();
            updateCurrentEngineUI();
            
            // 重新渲染高亮状态
            engineDropdown.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            if (!isEditMode) {
                engineDropdown.classList.remove('active');
                searchInput.focus();
            }
        });

        engineDropdown.appendChild(item);
    });

    // 内部额外附着一个新增按钮
    const addBtn = document.createElement('div');
    addBtn.className = 'dropdown-add-btn';
    addBtn.textContent = '+ 新增引擎';
    addBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openEngineModal();
    });
    engineDropdown.appendChild(addBtn);
}

function updateCurrentEngineUI() {
    if (searchEngines.length === 0) return;
    const engine = searchEngines[currentEngineIndex] || searchEngines[0];
    currentSearchUrl = engine.url;
    if (currentEngineIcon) currentEngineIcon.src = engine.icon;
    if (currentEngineName) currentEngineName.textContent = engine.name;
}

function saveEngines() {
    localStorage.setItem('apple_search_engines', JSON.stringify(searchEngines));
    localStorage.setItem('apple_current_engine', currentEngineIndex.toString());
}

if (engineSelectorBtn && engineDropdown) {
    // 首次载入渲染
    renderEngineDropdown();
    updateCurrentEngineUI();

    engineSelectorBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        engineDropdown.classList.toggle('active');
    });

    // 点击空白处关闭搜索引擎下拉框
    document.addEventListener('click', (e) => {
        if (!engineSelectorBtn.contains(e.target)) {
            engineDropdown.classList.remove('active');
        }
    });
}

// 引擎新增和编辑模态框逻辑
const addEngineModal = document.getElementById('addEngineModal');
const engineNameInput = document.getElementById('engineNameInput');
const engineUrlInput = document.getElementById('engineUrlInput');
const cancelEngineBtn = document.getElementById('cancelEngineBtn');
const saveEngineBtn = document.getElementById('saveEngineBtn');
let editingEngineIndex = null;

function openEngineModal(editIndex = null) {
    editingEngineIndex = editIndex;
    const titleEl = addEngineModal.querySelector('h3');
    if (titleEl) {
        titleEl.textContent = editIndex !== null ? '编辑搜索引擎' : '添加搜索引擎';
    }
    
    if (editIndex !== null && searchEngines[editIndex]) {
        engineNameInput.value = searchEngines[editIndex].name;
        engineUrlInput.value = searchEngines[editIndex].url;
    } else {
        engineNameInput.value = '';
        engineUrlInput.value = '';
    }
    
    addEngineModal.classList.add('active');
    engineNameInput.focus();
}

function closeEngineModal() {
    addEngineModal.classList.remove('active');
    editingEngineIndex = null;
}

if (addEngineModal) {
    cancelEngineBtn.addEventListener('click', closeEngineModal);
    saveEngineBtn.addEventListener('click', () => {
        const name = engineNameInput.value.trim();
        const url = engineUrlInput.value.trim();
        if (!name || !url) {
            alert('名称和URL不能为空');
            return;
        }
        
        let icon = getFavicon(url) || 'icons/google.ico'; 
        
        if (editingEngineIndex !== null) {
            // 编辑已有项，但这里判断 URL 如果修改了可能导致老图标丢失，如果想严格点可以判断：
            const oldItem = searchEngines[editingEngineIndex];
            icon = (oldItem.url === url) ? oldItem.icon : (getFavicon(url) || 'icons/google.ico');
            searchEngines[editingEngineIndex] = { name, url, icon };
        } else {
            // 新增项
            searchEngines.push({ name, url, icon });
        }
        
        saveEngines();
        updateCurrentEngineUI();
        renderEngineDropdown();
        closeEngineModal();
        engineDropdown.classList.add('active');
    });
    
    addEngineModal.addEventListener('click', (e) => {
        if (e.target === addEngineModal) closeEngineModal();
    });
}

if (searchInput) {
    searchInput.addEventListener('keypress', (e) => {
        // 回车键响应
        if (e.key === 'Enter' && searchInput.value.trim() !== '') {
            const searchUrl = currentSearchUrl + encodeURIComponent(searchInput.value.trim());
            // 打开并在新标签页中搜索
            window.open(searchUrl, '_blank');
            searchInput.value = ''; // 搜索完成后清空输入框
        }
    });
}

// ================== 点击背景返回首页 ==================
document.addEventListener('click', (e) => {
    // 排除点击主体容器、设置面板和各种弹窗的情况
    const isOutsideMain = !e.target.closest('.main-container');
    const isOutsideSettings = !e.target.closest('.settings-wrapper');
    const isOutsideModal = !e.target.closest('.modal');

    // 如果判定为点击了背景区域
    if (isOutsideMain && isOutsideSettings && isOutsideModal) {
        // 并且当前不在首页时，执行返回首页的逻辑
        if (typeof currentHoveredFolderId !== 'undefined' && currentHoveredFolderId !== 'HOME') {
            loadSearchPane();
            updateLeftActiveState('HOME');
        }
    }
});