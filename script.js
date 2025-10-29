class FirebaseService {
    constructor() {
        this.db = window.firebaseDB;
        this.isFirebaseReady = false;
        this.checkFirebaseConnection();
    }

    checkFirebaseConnection() {
        try {
            if (this.db) {
                this.isFirebaseReady = true;
                console.log('✅ Firebase conectado correctamente');
            } else {
                this.isFirebaseReady = false;
                console.warn('⚠️ Firebase no está configurado, usando localStorage como respaldo');
            }
        } catch (error) {
            this.isFirebaseReady = false;
            console.error('❌ Error al conectar con Firebase:', error);
        }
    }

    async getData(path) {
        if (!this.isFirebaseReady) {
            const data = localStorage.getItem(path);
            return data ? JSON.parse(data) : null;
        }

        try {
            const snapshot = await this.db.ref(path).once('value');
            return snapshot.val();
        } catch (error) {
            console.error(`Error al leer ${path}:`, error);
            const fallback = localStorage.getItem(path);
            return fallback ? JSON.parse(fallback) : null;
        }
    }

    async setData(path, data) {
        localStorage.setItem(path, JSON.stringify(data));

        if (!this.isFirebaseReady) {
            return Promise.resolve();
        }

        try {
            await this.db.ref(path).set(data);
        } catch (error) {
            console.error(`Error al guardar en ${path}:`, error);
        }
    }

    listenToChanges(path, callback) {
        if (!this.isFirebaseReady) return;

        try {
            this.db.ref(path).on('value', (snapshot) => {
                const data = snapshot.val();
                if (data) {
                    localStorage.setItem(path, JSON.stringify(data));
                    callback(data);
                }
            });
        } catch (error) {
            console.error(`Error al escuchar cambios en ${path}:`, error);
        }
    }
}

class BetaTestersSystem {
    constructor() {
        this.currentUser = null;
        this.currentEditingUser = null;
        this.firebase = new FirebaseService();
        this.init();
    }

    async init() {
        await this.initializeDefaultData();
        this.setupEventListeners();
        this.setupTabs();
        await this.checkSession();
        this.cleanOldTempPasswords();
        this.setupFirebaseListeners();

        window.addEventListener('beforeunload', () => {
            this.cleanOldTempPasswords();
        });
    }

    setupFirebaseListeners() {
        this.firebase.listenToChanges('accountRequests', (data) => {
            if (this.currentUser && this.currentUser.role === 'admin') {
                console.log('🔔 Nuevas solicitudes detectadas');
                this.loadAccountRequests();
            }
        });

        this.firebase.listenToChanges('users', (data) => {
            if (this.currentUser && this.currentUser.role === 'admin') {
                console.log('🔔 Cambios en usuarios detectados');
                this.loadAccountsList();
            }
        });

        this.firebase.listenToChanges('notifications', (data) => {
            if (this.currentUser) {
                console.log('🔔 Nuevas notificaciones detectadas');
                if (this.currentUser.role === 'user') {
                    this.loadUserNotifications();
                }
            }
        });
    }

    cleanOldTempPasswords() {
        const keys = Object.keys(sessionStorage);
        keys.forEach(key => {
            if (key.startsWith('temp_pwd_') && !key.endsWith('_time')) {
                const timestamp = sessionStorage.getItem(key + '_time');
                if (timestamp) {
                    const elapsed = Date.now() - parseInt(timestamp);
                    if (elapsed > 1800000) {
                        sessionStorage.removeItem(key);
                        sessionStorage.removeItem(key + '_time');
                    }
                }
            }
        });
    }

    showLoader(text = 'Cargando...') {
        document.getElementById('loaderText').textContent = text;
        document.getElementById('globalLoader').classList.remove('hidden');
    }

    hideLoader() {
        document.getElementById('globalLoader').classList.add('hidden');
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async randomDelay() {
        const min = 1000;
        const max = 3000;
        const randomTime = Math.floor(Math.random() * (max - min + 1)) + min;
        return this.delay(randomTime);
    }

    setupTabs() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const parent = e.target.closest('#adminPanel, #userPanel');
                const targetTab = e.target.dataset.tab;

                parent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                parent.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

                e.target.classList.add('active');
                parent.querySelector(`#${targetTab}`).classList.add('active');
            });
        });
    }

    hashPassword(password) {
        let hash = 0;
        const salt1 = "BT_SECURE_2024_v1_";
        const salt2 = "_ROBLOX_BETA_SYSTEM";
        const str = salt1 + password + salt2;

        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }

        let secondHash = Math.abs(hash).toString(36);
        for (let i = 0; i < secondHash.length; i++) {
            const char = secondHash.charCodeAt(i);
            hash = ((hash << 3) - hash) + char;
        }

        return Math.abs(hash).toString(36);
    }

    encryptData(data) {
        const str = JSON.stringify(data);
        const encrypted = btoa(unescape(encodeURIComponent(str)));
        return btoa(encrypted);
    }

    decryptData(encrypted) {
        try {
            const decoded = atob(encrypted);
            const str = decodeURIComponent(escape(atob(decoded)));
            return JSON.parse(str);
        } catch (e) {
            return null;
        }
    }

    initializeDefaultData() {
        const version = localStorage.getItem('bt_version');
        if (version !== '2.0') {
            localStorage.clear();
            localStorage.setItem('bt_version', '2.0');
        }

        if (!localStorage.getItem('bt_users')) {
            localStorage.setItem('bt_users', this.encryptData([]));
        }

        if (!localStorage.getItem('bt_gameStatus')) {
            localStorage.setItem('bt_gameStatus', this.encryptData({
                available: false,
                link: ''
            }));
        }

        if (!localStorage.getItem('bt_bugs')) {
            localStorage.setItem('bt_bugs', this.encryptData([]));
        }

        if (!localStorage.getItem('bt_suggestions')) {
            localStorage.setItem('bt_suggestions', this.encryptData([]));
        }

        if (!localStorage.getItem('bt_notifications')) {
            localStorage.setItem('bt_notifications', this.encryptData([]));
        }

        if (!localStorage.getItem('bt_logs')) {
            localStorage.setItem('bt_logs', this.encryptData([]));
        }

        if (!localStorage.getItem('bt_accountRequests')) {
            localStorage.setItem('bt_accountRequests', this.encryptData([]));
        }

        if (!localStorage.getItem('bt_websiteShutdown')) {
            localStorage.setItem('bt_websiteShutdown', this.encryptData({
                isShutdown: false,
                reason: ''
            }));
        }

        if (!localStorage.getItem('bt_accountRequestsEnabled')) {
            localStorage.setItem('bt_accountRequestsEnabled', 'true');
        }
    }

    getAccountRequestsEnabled() {
        return localStorage.getItem('bt_accountRequestsEnabled') === 'true';
    }

    setAccountRequestsEnabled(enabled) {
        localStorage.setItem('bt_accountRequestsEnabled', enabled ? 'true' : 'false');
    }

    async getUsers() {
        const data = await this.firebase.getData('users');
        if (data) {
            return data;
        }
        const encrypted = localStorage.getItem('bt_users');
        return this.decryptData(encrypted) || [];
    }

    async saveUsers(users) {
        const encrypted = this.encryptData(users);
        localStorage.setItem('bt_users', encrypted);
        await this.firebase.setData('users', users);
    }

    async getGameStatus() {
        const data = await this.firebase.getData('gameStatus');
        if (data) {
            return data;
        }
        const encrypted = localStorage.getItem('bt_gameStatus');
        return this.decryptData(encrypted) || { available: false, link: '' };
    }

    async saveGameStatus(status) {
        const encrypted = this.encryptData(status);
        localStorage.setItem('bt_gameStatus', encrypted);
        await this.firebase.setData('gameStatus', status);
    }

    async getBugs() {
        const data = await this.firebase.getData('bugs');
        if (data) {
            return data;
        }
        const encrypted = localStorage.getItem('bt_bugs');
        return this.decryptData(encrypted) || [];
    }

    async saveBugs(bugs) {
        const encrypted = this.encryptData(bugs);
        localStorage.setItem('bt_bugs', encrypted);
        await this.firebase.setData('bugs', bugs);
    }

    async getSuggestions() {
        const data = await this.firebase.getData('suggestions');
        if (data) {
            return data;
        }
        const encrypted = localStorage.getItem('bt_suggestions');
        return this.decryptData(encrypted) || [];
    }

    async saveSuggestions(suggestions) {
        const encrypted = this.encryptData(suggestions);
        localStorage.setItem('bt_suggestions', encrypted);
        await this.firebase.setData('suggestions', suggestions);
    }

    async getNotifications() {
        const data = await this.firebase.getData('notifications');
        if (data) {
            return data;
        }
        const encrypted = localStorage.getItem('bt_notifications');
        return this.decryptData(encrypted) || [];
    }

    async saveNotifications(notifications) {
        const encrypted = this.encryptData(notifications);
        localStorage.setItem('bt_notifications', encrypted);
        await this.firebase.setData('notifications', notifications);
    }

    async getLogs() {
        const data = await this.firebase.getData('logs');
        if (data) {
            return data;
        }
        const encrypted = localStorage.getItem('bt_logs');
        return this.decryptData(encrypted) || [];
    }

    async saveLogs(logs) {
        const encrypted = this.encryptData(logs);
        localStorage.setItem('bt_logs', encrypted);
        await this.firebase.setData('logs', logs);
    }

    async addLog(type, message) {
        const logs = await this.getLogs();
        logs.unshift({
            type,
            message,
            user: this.currentUser ? this.currentUser.username : 'Sistema',
            timestamp: new Date().toLocaleString('es-ES')
        });
        if (logs.length > 100) logs.pop();
        await this.saveLogs(logs);
    }

    async addInternalNotification(recipient, type, title, message) {
        const notifications = await this.getNotifications();

        if (recipient === 'all') {
            const users = (await this.getUsers()).filter(u => u.role === 'user');
            users.forEach(user => {
                notifications.push({
                    recipient: user.username,
                    type,
                    title,
                    message,
                    timestamp: new Date().toLocaleString('es-ES'),
                    read: false,
                    isGlobal: true
                });
            });
        } else {
            notifications.push({
                recipient,
                type,
                title,
                message,
                timestamp: new Date().toLocaleString('es-ES'),
                read: false,
                isGlobal: false
            });
        }

        await this.saveNotifications(notifications);
    }

    async addGlobalNotificationsToNewUser(username) {
        const notifications = await this.getNotifications();
        const globalNotifications = notifications.filter(n => n.isGlobal);

        const uniqueNotifications = [];
        const seen = new Set();

        globalNotifications.forEach(notif => {
            const key = `${notif.title}-${notif.message}-${notif.timestamp}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueNotifications.push({
                    recipient: username,
                    type: notif.type,
                    title: notif.title,
                    message: notif.message,
                    timestamp: notif.timestamp,
                    read: false,
                    isGlobal: true
                });
            }
        });

        notifications.push(...uniqueNotifications);
        await this.saveNotifications(notifications);
    }

    async getAccountRequests() {
        const data = await this.firebase.getData('accountRequests');
        if (data) {
            return data;
        }
        const encrypted = localStorage.getItem('bt_accountRequests');
        return this.decryptData(encrypted) || [];
    }

    async saveAccountRequests(requests) {
        const encrypted = this.encryptData(requests);
        localStorage.setItem('bt_accountRequests', encrypted);
        await this.firebase.setData('accountRequests', requests);
    }

    setupEventListeners() {
        document.getElementById('initialSetupForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.completeInitialSetup();
        });

        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.login();
        });

        document.getElementById('logoutBtn')?.addEventListener('click', () => this.logout());
        document.getElementById('logoutBtnUser')?.addEventListener('click', () => this.logout());

        document.getElementById('showCreateAccount')?.addEventListener('click', () => {
            document.getElementById('createAccountForm').classList.toggle('hidden');
        });

        document.getElementById('createAccountBtn')?.addEventListener('click', () => this.createAccount());
        document.getElementById('cancelCreateBtn')?.addEventListener('click', () => {
            document.getElementById('createAccountForm').classList.add('hidden');
        });

        document.getElementById('saveGameStatus')?.addEventListener('click', () => this.updateGameStatus());
        document.getElementById('saveDiscord')?.addEventListener('click', () => this.saveDiscordLink());

        document.getElementById('cancelEditBtn')?.addEventListener('click', () => {
            document.getElementById('editModal').classList.add('hidden');
        });
        document.getElementById('saveEditBtn')?.addEventListener('click', () => this.saveEdit());
        document.getElementById('deleteAccountBtn')?.addEventListener('click', () => this.deleteAccount());

        document.getElementById('changePasswordBtnAdmin')?.addEventListener('click', () => this.showChangePasswordModal());
        document.getElementById('changePasswordBtnUser')?.addEventListener('click', () => this.showChangePasswordModal());
        document.getElementById('changePasswordBtnUser2')?.addEventListener('click', () => this.showChangePasswordModal());
        document.getElementById('cancelChangePassword')?.addEventListener('click', () => this.closeChangePasswordModal());
        document.getElementById('saveNewPassword')?.addEventListener('click', () => this.changePassword());

        document.getElementById('submitBug')?.addEventListener('click', () => this.submitBug());
        document.getElementById('submitSuggestion')?.addEventListener('click', () => this.submitSuggestion());
        document.getElementById('sendNotification')?.addEventListener('click', () => this.sendNotification());
        document.getElementById('clearLogs')?.addEventListener('click', () => this.clearLogs());
        document.getElementById('logFilter')?.addEventListener('change', () => this.loadLogs());
        document.getElementById('markAllRead')?.addEventListener('click', () => this.markAllNotificationsRead());
        document.getElementById('clearNotifications')?.addEventListener('click', () => this.clearUserNotifications());
        document.getElementById('notifRecipient')?.addEventListener('change', (e) => {
            const specific = document.getElementById('specificUserGroup');
            if (e.target.value === 'specific') {
                specific.classList.remove('hidden');
                this.loadUserSelector();
            } else {
                specific.classList.add('hidden');
            }
        });

        document.getElementById('showRequestAccountBtn')?.addEventListener('click', () => {
            document.getElementById('loginContainer').classList.add('hidden');
            document.getElementById('requestAccountContainer').classList.remove('hidden');
        });

        document.getElementById('backToLogin')?.addEventListener('click', () => {
            document.getElementById('requestAccountContainer').classList.add('hidden');
            document.getElementById('loginContainer').classList.remove('hidden');
        });

        document.getElementById('requestAccountForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitAccountRequest();
        });

        document.getElementById('showPublicLogsBtn')?.addEventListener('click', () => {
            document.getElementById('loginContainer').classList.add('hidden');
            document.getElementById('publicLogsContainer').classList.remove('hidden');
            this.loadPublicLogs();
        });

        document.getElementById('backToLoginFromLogs')?.addEventListener('click', () => {
            document.getElementById('publicLogsContainer').classList.add('hidden');
            document.getElementById('loginContainer').classList.remove('hidden');
        });
    }

    generateRandomPassword() {
        return Math.floor(1000 + Math.random() * 9000).toString();
    }

    async login() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const errorDiv = document.getElementById('loginError');

        this.showLoader('Verificando credenciales...');
        await this.randomDelay();

        const users = await this.getUsers();
        const user = users.find(u =>
            u.username === username && u.password === this.hashPassword(password)
        );

        if (user) {
            this.currentUser = user;
            sessionStorage.setItem('bt_session', this.encryptData({ username: user.username }));
            localStorage.setItem('bt_last_username', user.username);
            await this.addLog('login', `${user.username} ha iniciado sesión`);
            this.hideLoader();
            this.showPanel(user.role);
            errorDiv.textContent = '';
        } else {
            this.hideLoader();
            errorDiv.textContent = 'Usuario o contraseña incorrectos';
        }
    }

    async checkSession() {
        const session = sessionStorage.getItem('bt_session');
        if (session) {
            const sessionData = this.decryptData(session);
            if (sessionData) {
                const users = await this.getUsers();
                const user = users.find(u => u.username === sessionData.username);
                if (user) {
                    this.currentUser = user;
                    this.showPanel(user.role);
                }
            }
        } else {
            const lastUsername = localStorage.getItem('bt_last_username');
            if (lastUsername) {
                const usernameInput = document.getElementById('username');
                if (usernameInput) {
                    usernameInput.value = lastUsername;
                }
            }
        }
    }

    async logout() {
        this.showLoader('Cerrando sesión...');
        await this.randomDelay();

        this.currentUser = null;
        sessionStorage.removeItem('bt_session');

        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');

        const lastUsername = localStorage.getItem('bt_last_username');
        usernameInput.value = lastUsername || '';
        passwordInput.value = '';
        usernameInput.disabled = false;
        passwordInput.disabled = false;
        usernameInput.readOnly = false;
        passwordInput.readOnly = false;

        document.getElementById('loginContainer').classList.remove('hidden');
        document.getElementById('adminPanel').classList.add('hidden');
        document.getElementById('userPanel').classList.add('hidden');
        document.getElementById('requestAccountContainer').classList.add('hidden');
        document.getElementById('publicLogsContainer').classList.add('hidden');
        document.getElementById('initialSetupContainer').classList.add('hidden');

        this.hideLoader();
    }

    async submitAccountRequest() {
        if (!this.getAccountRequestsEnabled()) {
            alert('Las solicitudes de cuenta están deshabilitadas temporalmente. Por favor intenta más tarde.');
            return;
        }

        const username = document.getElementById('requestUsername').value;
        const password = document.getElementById('requestPassword').value;
        const robloxName = document.getElementById('requestRoblox').value;
        const reason = document.getElementById('requestReason').value;
        const errorDiv = document.getElementById('requestError');

        errorDiv.textContent = '';

        if (!username || !password || !robloxName || !reason) {
            errorDiv.textContent = 'Por favor completa todos los campos';
            return;
        }

        if (!/^\d{4}$/.test(password)) {
            errorDiv.textContent = 'La contraseña debe ser de 4 dígitos';
            return;
        }

        const users = await this.getUsers();
        if (users.find(u => u.username === username)) {
            errorDiv.textContent = 'Este nombre de usuario ya está en uso';
            return;
        }

        const requests = await this.getAccountRequests();
        if (requests.find(r => r.username === username && r.status === 'pending')) {
            errorDiv.textContent = 'Ya existe una solicitud pendiente con este nombre de usuario';
            return;
        }

        this.showLoader('Enviando solicitud...');
        await this.randomDelay();

        const newRequest = {
            id: Date.now(),
            username,
            password: this.hashPassword(password),
            plainPassword: password,
            robloxName,
            reason,
            status: 'pending',
            timestamp: new Date().toLocaleString('es-ES')
        };

        requests.push(newRequest);
        await this.saveAccountRequests(requests);

        const admins = (await this.getUsers()).filter(u => u.role === 'admin');

        if (admins.length === 0) {
            console.warn('⚠️ No hay administradores en el sistema para recibir la notificación');
        } else {
            admins.forEach(admin => {
                this.addInternalNotification(admin.username, 'info', 'Nueva Solicitud de Cuenta', `${username} solicitó una cuenta`);
            });
        }

        document.getElementById('requestAccountForm').reset();
        document.getElementById('requestAccountContainer').classList.add('hidden');
        document.getElementById('loginContainer').classList.remove('hidden');

        this.hideLoader();
        alert('Se ha enviado el informe, estate pendiente de los logs de cuentas');

        console.log('✅ Solicitud guardada:', newRequest);
        console.log('📋 Total de solicitudes:', requests.length);
        console.log('👥 Administradores que recibieron notificación:', admins.length);
    }

    showPanel(role) {
        document.getElementById('loginContainer').classList.add('hidden');

        if (role === 'admin') {
            document.getElementById('adminPanel').classList.remove('hidden');
            this.loadUserHeaderInfo('admin');
            this.loadAdminPanel();
        } else {
            document.getElementById('userPanel').classList.remove('hidden');
            this.loadUserHeaderInfo('user');
            this.loadUserPanel();
        }
    }

    loadUserHeaderInfo(panelType) {
        if (!this.currentUser) return;

        const initial = this.currentUser.username.charAt(0).toUpperCase();
        const avatarId = panelType === 'admin' ? 'adminAvatar' : 'userAvatar';
        const nameId = panelType === 'admin' ? 'adminHeaderName' : 'userHeaderName';

        const avatarElement = document.getElementById(avatarId);
        const nameElement = document.getElementById(nameId);

        if (avatarElement) {
            avatarElement.textContent = initial;
        }

        if (nameElement) {
            nameElement.textContent = this.currentUser.username;
        }
    }

    loadAdminPanel() {
        this.loadDashboard();
        this.loadGameStatusControl();
        this.loadAccountsList();
        this.loadAccountRequests();
        this.loadAdminBugs();
        this.loadAdminSuggestions();
        this.loadLogs();
    }

    async loadGameStatusControl() {
        const status = await this.getGameStatus();
        document.getElementById('gameAvailable').checked = status.available;
        document.getElementById('gameLink').value = status.link || '';
    }

    async updateGameStatus() {
        this.showLoader('Actualizando estado del juego...');
        await this.randomDelay();

        const available = document.getElementById('gameAvailable').checked;
        const link = document.getElementById('gameLink').value;

        await this.saveGameStatus({ available, link });
        await this.addLog('game', `Estado del juego cambiado a ${available ? 'disponible' : 'no disponible'}`);

        if (available) {
            await this.addInternalNotification('all', 'success', '¡Juego Disponible!', 'El juego ya está disponible para jugar');
        }

        this.hideLoader();
        alert('Estado del juego actualizado');
        if (this.currentUser?.role === 'admin') {
            this.loadDashboard();
        }
    }

    async loadAccountsList() {
        const users = await this.getUsers();
        const container = document.getElementById('accountsList');

        container.innerHTML = '<h3>Cuentas Existentes</h3>';

        users.forEach((user, index) => {
            const div = document.createElement('div');
            div.className = 'account-card';

            let passwordDisplay;
            if (user.plainPassword) {
                passwordDisplay = `<span id="pwd_${user.username}" style="display:none;">${user.plainPassword}</span><span id="pwd_hidden_${user.username}">****</span> <button class="btn-eye" onclick="system.togglePassword('${user.username}')" style="border:none;background:none;cursor:pointer;font-size:16px;margin-left:5px;" title="Mostrar/Ocultar contraseña">👁️</button>`;
            } else {
                if (user.username === 'ducky_y2') {
                    passwordDisplay = `****<small style="color:#999;margin-left:8px;">(protegida)</small>`;
                } else {
                    passwordDisplay = `****<small style="color:#999;margin-left:8px;">(no disponible - <a href="#" onclick="system.editAccount('${user.username}'); return false;" style="color:#3b82f6;">cambiar contraseña</a>)</small>`;
                }
            }

            const canEdit = (user.username === 'ducky_y2' && this.currentUser.username === 'ducky_y2') || user.username !== 'ducky_y2';
            const editButton = canEdit ? `<button class="btn btn-primary" onclick="system.editAccount('${user.username}')">Editar</button>` : '';

            div.innerHTML = `
                <div class="account-info">
                    <p><strong>Usuario:</strong> ${user.username}</p>
                    <p><strong>Roblox:</strong> ${user.robloxName}</p>
                    <p><strong>Contraseña:</strong> ${passwordDisplay}</p>
                    <p><strong>Rol:</strong> <span class="badge badge-${user.role}">${user.role.toUpperCase()}</span></p>
                    ${user.discord ? `<p><strong>Discord:</strong> ${user.discord}</p>` : ''}
                </div>
                <div class="account-actions">
                    ${editButton}
                </div>
            `;
            container.appendChild(div);
        });
    }

    getTempPassword(username) {
        const temp = sessionStorage.getItem(`temp_pwd_${username}`);
        if (temp) {
            const timestamp = sessionStorage.getItem(`temp_pwd_${username}_time`);
            if (timestamp) {
                const elapsed = Date.now() - parseInt(timestamp);
                if (elapsed > 1800000) {
                    sessionStorage.removeItem(`temp_pwd_${username}`);
                    sessionStorage.removeItem(`temp_pwd_${username}_time`);
                    return null;
                }
            }
        }
        return temp;
    }

    setTempPassword(username, password) {
        sessionStorage.setItem(`temp_pwd_${username}`, password);
        sessionStorage.setItem(`temp_pwd_${username}_time`, Date.now().toString());
    }

    async createAccount() {
        const username = document.getElementById('newUsername').value;
        const robloxName = document.getElementById('newRobloxName').value;
        const role = document.getElementById('newRole').value;

        if (!username || !robloxName) {
            alert('Por favor completa todos los campos');
            return;
        }

        const users = await this.getUsers();

        if (users.find(u => u.username === username)) {
            alert('Este nombre de usuario ya existe');
            return;
        }

        this.showLoader('Creando cuenta...');
        await this.randomDelay();

        const password = this.generateRandomPassword();

        users.push({
            username,
            password: this.hashPassword(password),
            plainPassword: password,
            role,
            robloxName,
            discord: null
        });

        await this.saveUsers(users);
        this.setTempPassword(username, password);

        if (role === 'user') {
            await this.addGlobalNotificationsToNewUser(username);
        }

        document.getElementById('newUsername').value = '';
        document.getElementById('newRobloxName').value = '';
        document.getElementById('newRole').value = 'user';
        document.getElementById('createAccountForm').classList.add('hidden');

        this.loadAccountsList();
        this.hideLoader();
        alert(`Cuenta creada correctamente.\n\nUsuario: ${username}\nContraseña: ${password}\n\nGuarda esta información, no se volverá a mostrar.`);
        if (this.currentUser?.role === 'admin') {
            this.loadDashboard();
        }
    }

    async loadAccountRequests() {
        const requests = await this.getAccountRequests();
        const pendingContainer = document.getElementById('pendingRequestsList');
        const acceptedContainer = document.getElementById('acceptedRequestsList');

        const pendingRequests = requests.filter(r => r.status === 'pending');
        const acceptedRequests = requests.filter(r => r.status === 'accepted').slice(-2);

        if (pendingRequests.length === 0) {
            pendingContainer.innerHTML = '<p class="no-data">No hay solicitudes pendientes</p>';
        } else {
            pendingContainer.innerHTML = '';
            pendingRequests.forEach(request => {
                const div = document.createElement('div');
                div.className = 'request-card';
                div.innerHTML = `
                    <div class="request-info">
                        <p><strong>Usuario:</strong> ${request.username}</p>
                        <p><strong>Roblox:</strong> ${request.robloxName}</p>
                        <p><strong>Razón:</strong> ${request.reason}</p>
                        <p><strong>Fecha:</strong> ${request.timestamp}</p>
                    </div>
                    <div class="request-actions">
                        <button class="btn btn-success" onclick="system.approveRequest(${request.id})">Aprobar</button>
                        <button class="btn btn-danger" onclick="system.rejectRequest(${request.id})">Rechazar</button>
                    </div>
                `;
                pendingContainer.appendChild(div);
            });
        }

        if (acceptedRequests.length === 0) {
            acceptedContainer.innerHTML = '<p class="no-data">No hay cuentas aceptadas recientemente</p>';
        } else {
            acceptedContainer.innerHTML = '';
            acceptedRequests.forEach(request => {
                const div = document.createElement('div');
                div.className = 'request-card accepted';
                div.innerHTML = `
                    <div class="request-info">
                        <p><strong>Usuario:</strong> ${request.username}</p>
                        <p><strong>Roblox:</strong> ${request.robloxName}</p>
                        <p><strong>Aceptado:</strong> ${request.acceptedAt}</p>
                    </div>
                `;
                acceptedContainer.appendChild(div);
            });
        }
    }

    async approveRequest(requestId) {
        if (!confirm('¿Aprobar esta solicitud de cuenta?')) return;

        this.showLoader('Aprobando solicitud...');
        await this.randomDelay();

        const requests = await this.getAccountRequests();
        const request = requests.find(r => r.id === requestId);

        if (!request) {
            this.hideLoader();
            alert('Solicitud no encontrada');
            return;
        }

        const users = await this.getUsers();

        if (users.find(u => u.username === request.username)) {
            this.hideLoader();
            alert('Error: Ya existe una cuenta con este nombre de usuario. No se puede aprobar la solicitud.');
            return;
        }

        users.push({
            username: request.username,
            password: request.password,
            plainPassword: request.plainPassword || '****',
            role: 'user',
            robloxName: request.robloxName,
            discord: null
        });

        await this.saveUsers(users);

        await this.addGlobalNotificationsToNewUser(request.username);

        request.status = 'accepted';
        request.acceptedAt = new Date().toLocaleString('es-ES');
        await this.saveAccountRequests(requests);

        await this.addLog('account', `Solicitud de cuenta aprobada: ${request.username}`);

        this.loadAccountRequests();
        this.loadAccountsList();
        this.loadDashboard();
        this.hideLoader();
        alert(`Cuenta de ${request.username} aprobada correctamente`);
    }

    async rejectRequest(requestId) {
        if (!confirm('¿Rechazar esta solicitud de cuenta?')) return;

        this.showLoader('Rechazando solicitud...');
        await this.randomDelay();

        const requests = await this.getAccountRequests();
        const requestIndex = requests.findIndex(r => r.id === requestId);

        if (requestIndex === -1) {
            this.hideLoader();
            alert('Solicitud no encontrada');
            return;
        }

        const request = requests[requestIndex];
        requests.splice(requestIndex, 1);
        await this.saveAccountRequests(requests);

        this.loadAccountRequests();
        this.hideLoader();
        alert('Solicitud rechazada');
    }

    async editAccount(username) {
        const users = await this.getUsers();
        const user = users.find(u => u.username === username);

        if (!user) return;

        this.currentEditingUser = username;
        document.getElementById('editUsername').value = user.username;
        document.getElementById('editPassword').value = '';
        document.getElementById('editRobloxName').value = user.robloxName;
        document.getElementById('editRole').value = user.role;

        document.getElementById('editModal').classList.remove('hidden');
    }

    async saveEdit() {
        if (this.currentEditingUser === 'ducky_y2' && this.currentUser.username !== 'ducky_y2') {
            alert('No puedes editar la cuenta de ducky_y2');
            return;
        }

        const users = await this.getUsers();
        const user = users.find(u => u.username === this.currentEditingUser);

        if (!user) return;

        const newPassword = document.getElementById('editPassword').value;
        const newRobloxName = document.getElementById('editRobloxName').value;
        const newRole = document.getElementById('editRole').value;

        if (newPassword) {
            const editingUser = users.find(u => u.username === this.currentEditingUser);
            const isMainAdmin = editingUser && editingUser.isMainAdmin === true;
            const validPattern = isMainAdmin ? /^\d{4,6}$/ : /^\d{4}$/;

            if (!validPattern.test(newPassword)) {
                alert(isMainAdmin ? 'La contraseña debe ser de 4 a 6 dígitos' : 'La contraseña debe ser de 4 dígitos');
                return;
            }
        }

        this.showLoader('Guardando cambios...');
        await this.randomDelay();

        if (newPassword) {
            user.password = this.hashPassword(newPassword);
            user.plainPassword = newPassword;
            this.setTempPassword(user.username, newPassword);
        }
        user.robloxName = newRobloxName;
        user.role = newRole;

        await this.saveUsers(users);
        document.getElementById('editModal').classList.add('hidden');
        this.loadAccountsList();
        this.hideLoader();
        alert('Cuenta actualizada');
    }

    async deleteAccount() {
        if (this.currentEditingUser === 'ducky_y2' && this.currentUser.username !== 'ducky_y2') {
            alert('No puedes eliminar la cuenta de ducky_y2');
            return;
        }

        if (!confirm('¿Estás seguro de eliminar esta cuenta?')) return;

        this.showLoader('Eliminando cuenta...');
        await this.randomDelay();

        const users = await this.getUsers();
        const index = users.findIndex(u => u.username === this.currentEditingUser);

        if (index === -1) return;

        users.splice(index, 1);
        await this.saveUsers(users);
        sessionStorage.removeItem(`temp_pwd_${this.currentEditingUser}`);
        sessionStorage.removeItem(`temp_pwd_${this.currentEditingUser}_time`);

        document.getElementById('editModal').classList.add('hidden');
        this.loadAccountsList();
        this.hideLoader();
        alert('Cuenta eliminada');
    }

    loadUserPanel() {
        this.loadUserGameStatus();
        this.loadUserProfile();
        this.loadMyBugs();
        this.loadMySuggestions();
        this.loadUserNotifications();
    }

    async loadUserGameStatus() {
        const status = await this.getGameStatus();
        const container = document.getElementById('gameStatusInfo');

        if (status.available) {
            container.innerHTML = `
                <div class="game-status-available">
                    <h3>✓ Juego Disponible</h3>
                    <p>El juego está actualmente disponible para testing</p>
                    ${status.link ? `<a href="${status.link}" target="_blank" class="game-link">Jugar Ahora</a>` : ''}
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="game-status-unavailable">
                    <h3>✗ Juego No Disponible</h3>
                    <p>El juego no está disponible en este momento</p>
                </div>
            `;
        }
    }

    loadUserProfile() {
        document.getElementById('profileUsername').textContent = this.currentUser.username;
        document.getElementById('profileRoblox').textContent = this.currentUser.robloxName;

        if (this.currentUser.discord) {
            document.getElementById('discordName').value = this.currentUser.discord;
            document.getElementById('discordStatus').innerHTML =
                '<small style="color: #28a745;">✓ Discord vinculado</small>';
        } else {
            document.getElementById('discordStatus').innerHTML =
                '<small style="color: #999;">Discord no vinculado</small>';
        }
    }

    async saveDiscordLink() {
        const discordName = document.getElementById('discordName').value;

        if (!discordName) {
            alert('Por favor ingresa tu nombre de Discord');
            return;
        }

        this.showLoader('Vinculando Discord...');
        await this.randomDelay();

        const users = await this.getUsers();
        const user = users.find(u => u.username === this.currentUser.username);

        if (user) {
            user.discord = discordName;
            this.currentUser.discord = discordName;
            await this.saveUsers(users);
            this.loadUserProfile();
            this.hideLoader();
            alert('Discord vinculado correctamente');
        }
    }

    showChangePasswordModal() {
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPasswordChange').value = '';
        document.getElementById('confirmPassword').value = '';
        document.getElementById('changePasswordError').textContent = '';
        document.getElementById('changePasswordModal').classList.remove('hidden');
    }

    closeChangePasswordModal() {
        document.getElementById('changePasswordModal').classList.add('hidden');
    }

    async changePassword() {
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPasswordChange').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const errorDiv = document.getElementById('changePasswordError');

        errorDiv.textContent = '';

        if (!currentPassword || !newPassword || !confirmPassword) {
            errorDiv.textContent = 'Por favor completa todos los campos';
            return;
        }

        const isMainAdmin = this.currentUser.isMainAdmin === true;
        const validPattern = isMainAdmin ? /^\d{4,6}$/ : /^\d{4}$/;

        if (!validPattern.test(newPassword)) {
            errorDiv.textContent = isMainAdmin ? 'La nueva contraseña debe ser de 4 a 6 dígitos numéricos' : 'La nueva contraseña debe ser de 4 dígitos numéricos';
            return;
        }

        if (newPassword !== confirmPassword) {
            errorDiv.textContent = 'Las contraseñas no coinciden';
            return;
        }

        const users = await this.getUsers();
        const user = users.find(u => u.username === this.currentUser.username);

        if (!user) {
            errorDiv.textContent = 'Error al encontrar usuario';
            return;
        }

        if (user.password !== this.hashPassword(currentPassword)) {
            errorDiv.textContent = 'La contraseña actual es incorrecta';
            return;
        }

        this.showLoader('Cambiando contraseña...');
        await this.randomDelay();

        user.password = this.hashPassword(newPassword);
        user.plainPassword = newPassword;
        this.currentUser.password = this.hashPassword(newPassword);
        this.setTempPassword(user.username, newPassword);
        await this.saveUsers(users);

        this.closeChangePasswordModal();
        this.hideLoader();
        alert('Contraseña cambiada correctamente');
    }

    async loadDashboard() {
        const users = await this.getUsers();
        const bugs = await this.getBugs();
        const suggestions = await this.getSuggestions();

        document.getElementById('totalUsers').textContent = users.length;
        document.getElementById('totalBugs').textContent = bugs.length;
        document.getElementById('totalSuggestions').textContent = suggestions.length;

        const logs = (await this.getLogs()).slice(0, 5);
        const container = document.getElementById('recentActivityList');
        container.innerHTML = '';

        if (logs.length === 0) {
            container.innerHTML = '<p style="color: #666;">No hay actividad reciente</p>';
            return;
        }

        logs.forEach(log => {
            const div = document.createElement('div');
            div.className = 'activity-item';
            div.innerHTML = `
                <span class="activity-text">${log.message}</span>
                <span class="activity-time">${log.timestamp}</span>
            `;
            container.appendChild(div);
        });
    }

    async loadLogs() {
        const filter = document.getElementById('logFilter')?.value || 'all';
        let logs = await this.getLogs();

        if (filter !== 'all') {
            logs = logs.filter(log => log.type === filter);
        }

        const container = document.getElementById('logsList');
        if (!container) return;

        container.innerHTML = '';

        if (logs.length === 0) {
            container.innerHTML = '<p style="color: #666;">No hay logs disponibles</p>';
            return;
        }

        logs.forEach(log => {
            const div = document.createElement('div');
            div.className = `log-item ${log.type}`;
            div.innerHTML = `
                <strong>${log.user}</strong> - ${log.message}
                <br><small style="color: #9ca3af;">${log.timestamp}</small>
            `;
            container.appendChild(div);
        });
    }

    async clearLogs() {
        if (confirm('¿Eliminar todos los logs?')) {
            this.showLoader('Limpiando logs...');
            await this.randomDelay();
            await this.saveLogs([]);
            this.loadLogs();
            this.hideLoader();
            alert('Logs eliminados');
        }
    }

    async loadPublicLogs() {
        let logs = await this.getLogs();
        logs = logs.filter(log => log.type === 'account');

        const container = document.getElementById('publicLogsList');
        if (!container) return;

        container.innerHTML = '';

        if (logs.length === 0) {
            container.innerHTML = '<p style="color: #666; text-align: center; padding: 40px;">No hay logs de cuentas disponibles</p>';
            return;
        }

        logs.forEach(log => {
            const div = document.createElement('div');
            div.className = `log-item ${log.type}`;
            div.innerHTML = `
                <strong>${log.user}</strong> - ${log.message}
                <br><small style="color: #9ca3af;">${log.timestamp}</small>
            `;
            container.appendChild(div);
        });
    }

    async loadUserSelector() {
        const users = (await this.getUsers()).filter(u => u.role === 'user');
        const selector = document.getElementById('specificUser');
        if (!selector) return;

        selector.innerHTML = '';
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.username;
            option.textContent = user.username;
            selector.appendChild(option);
        });
    }

    async sendNotification() {
        const recipient = document.getElementById('notifRecipient').value;
        const type = document.getElementById('notifType').value;
        const title = document.getElementById('notifTitle').value;
        const message = document.getElementById('notifMessage').value;

        if (!title || !message) {
            alert('Por favor completa todos los campos');
            return;
        }

        this.showLoader('Enviando notificación...');
        await this.randomDelay();

        const notifications = await this.getNotifications();

        if (recipient === 'all') {
            const users = (await this.getUsers()).filter(u => u.role === 'user');
            users.forEach(user => {
                notifications.push({
                    recipient: user.username,
                    type,
                    title,
                    message,
                    timestamp: new Date().toLocaleString('es-ES'),
                    read: false
                });
            });
        } else {
            const specificUser = document.getElementById('specificUser').value;
            notifications.push({
                recipient: specificUser,
                type,
                title,
                message,
                timestamp: new Date().toLocaleString('es-ES'),
                read: false
            });
        }

        await this.saveNotifications(notifications);
        await this.addLog('notification', `Notificación enviada: ${title}`);

        document.getElementById('notifTitle').value = '';
        document.getElementById('notifMessage').value = '';
        this.hideLoader();
        alert('Notificación enviada');
    }

    async submitBug() {
        const severity = document.getElementById('bugSeverity').value;
        const title = document.getElementById('bugTitle').value;
        const description = document.getElementById('bugDescription').value;
        const steps = document.getElementById('bugSteps').value;

        if (!title || !description) {
            alert('Por favor completa el título y descripción');
            return;
        }

        this.showLoader('Enviando reporte...');
        await this.randomDelay();

        const bugs = await this.getBugs();
        bugs.unshift({
            id: Date.now(),
            user: this.currentUser.username,
            severity,
            title,
            description,
            steps,
            timestamp: new Date().toLocaleString('es-ES'),
            status: 'open'
        });

        await this.saveBugs(bugs);
        await this.addLog('bug', `${this.currentUser.username} reportó un bug: ${title}`);

        const admins = (await this.getUsers()).filter(u => u.role === 'admin');
        for (const admin of admins) {
            await this.addInternalNotification(admin.username, 'warning', 'Nuevo Bug Reportado', `${this.currentUser.username}: ${title}`);
        }

        document.getElementById('bugTitle').value = '';
        document.getElementById('bugDescription').value = '';
        document.getElementById('bugSteps').value = '';

        this.loadMyBugs();
        this.hideLoader();
        alert('Bug reportado correctamente');
    }

    async loadMyBugs() {
        const bugs = (await this.getBugs()).filter(b => b.user === this.currentUser.username);
        const container = document.getElementById('myBugsList');
        if (!container) return;

        container.innerHTML = '';

        if (bugs.length === 0) {
            container.innerHTML = '<p style="color: #666;">No has reportado ningún bug</p>';
            return;
        }

        bugs.forEach(bug => {
            const div = document.createElement('div');
            div.className = 'bug-item';
            div.innerHTML = `
                <div class="bug-header">
                    <span class="bug-title">${bug.title}</span>
                    <span class="bug-severity severity-${bug.severity}">${bug.severity.toUpperCase()}</span>
                </div>
                <p style="color: #4b5563; font-size: 14px; margin: 8px 0;">${bug.description}</p>
                ${bug.steps ? `<p style="color: #6b7280; font-size: 13px;"><strong>Pasos:</strong> ${bug.steps}</p>` : ''}
                <small style="color: #9ca3af;">${bug.timestamp}</small>
            `;
            container.appendChild(div);
        });
    }

    async submitSuggestion() {
        const category = document.getElementById('suggestionCategory').value;
        const title = document.getElementById('suggestionTitle').value;
        const description = document.getElementById('suggestionDescription').value;

        if (!title || !description) {
            alert('Por favor completa el título y descripción');
            return;
        }

        this.showLoader('Enviando sugerencia...');
        await this.randomDelay();

        const suggestions = await this.getSuggestions();
        suggestions.unshift({
            id: Date.now(),
            user: this.currentUser.username,
            category,
            title,
            description,
            timestamp: new Date().toLocaleString('es-ES')
        });

        await this.saveSuggestions(suggestions);
        await this.addLog('suggestion', `${this.currentUser.username} envió una sugerencia: ${title}`);

        const admins = (await this.getUsers()).filter(u => u.role === 'admin');
        for (const admin of admins) {
            await this.addInternalNotification(admin.username, 'info', 'Nueva Sugerencia', `${this.currentUser.username}: ${title}`);
        }

        document.getElementById('suggestionTitle').value = '';
        document.getElementById('suggestionDescription').value = '';

        this.loadMySuggestions();
        this.hideLoader();
        alert('Sugerencia enviada correctamente');
    }

    async loadMySuggestions() {
        const suggestions = (await this.getSuggestions()).filter(s => s.user === this.currentUser.username);
        const container = document.getElementById('mySuggestionsList');
        if (!container) return;

        container.innerHTML = '';

        if (suggestions.length === 0) {
            container.innerHTML = '<p style="color: #666;">No has enviado ninguna sugerencia</p>';
            return;
        }

        suggestions.forEach(suggestion => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            div.innerHTML = `
                <div class="suggestion-header">
                    <span class="suggestion-title">${suggestion.title}</span>
                    <span class="suggestion-category" style="background: #dbeafe; color: #1e40af;">${suggestion.category}</span>
                </div>
                <p style="color: #4b5563; font-size: 14px; margin: 8px 0;">${suggestion.description}</p>
                <small style="color: #9ca3af;">${suggestion.timestamp}</small>
            `;
            container.appendChild(div);
        });
    }

    async loadAdminBugs() {
        const bugs = await this.getBugs();
        const container = document.getElementById('adminBugsList');
        if (!container) return;

        container.innerHTML = '';

        if (bugs.length === 0) {
            container.innerHTML = '<p class="no-data">No hay bugs reportados</p>';
            return;
        }

        bugs.forEach(bug => {
            const div = document.createElement('div');
            div.className = 'bug-item';

            const statusBadge = bug.status === 'fixed' ?
                '<span class="badge" style="background: #d1fae5; color: #059669;">ARREGLADO</span>' :
                '<span class="badge" style="background: #fee2e2; color: #dc2626;">ABIERTO</span>';

            const actionButton = bug.status !== 'fixed' ?
                `<button class="btn btn-success" onclick="system.markBugAsFixed(${bug.id})" style="margin-top: 10px;">Marcar como Arreglado</button>` :
                '';

            div.innerHTML = `
                <div class="bug-header">
                    <span class="bug-title">${bug.title}</span>
                    <div>
                        <span class="bug-severity severity-${bug.severity}">${bug.severity.toUpperCase()}</span>
                        ${statusBadge}
                    </div>
                </div>
                <p style="color: #4b5563; font-size: 14px; margin: 8px 0;"><strong>Reportado por:</strong> ${bug.user}</p>
                <p style="color: #4b5563; font-size: 14px; margin: 8px 0;">${bug.description}</p>
                ${bug.steps ? `<p style="color: #6b7280; font-size: 13px;"><strong>Pasos:</strong> ${bug.steps}</p>` : ''}
                <small style="color: #9ca3af;">${bug.timestamp}</small>
                ${actionButton}
            `;
            container.appendChild(div);
        });
    }

    async loadAdminSuggestions() {
        const suggestions = await this.getSuggestions();
        const container = document.getElementById('adminSuggestionsList');
        if (!container) return;

        container.innerHTML = '';

        if (suggestions.length === 0) {
            container.innerHTML = '<p class="no-data">No hay sugerencias enviadas</p>';
            return;
        }

        suggestions.forEach(suggestion => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';

            let statusBadge = '';
            let actionButtons = '';

            if (suggestion.status === 'accepted') {
                statusBadge = '<span class="badge" style="background: #d1fae5; color: #059669;">ACEPTADA</span>';
            } else if (suggestion.status === 'rejected') {
                statusBadge = '<span class="badge" style="background: #fee2e2; color: #dc2626;">RECHAZADA</span>';
            } else {
                statusBadge = '<span class="badge" style="background: #fef3c7; color: #d97706;">PENDIENTE</span>';
                actionButtons = `
                    <div style="margin-top: 10px; display: flex; gap: 10px;">
                        <button class="btn btn-success" onclick="system.acceptSuggestion(${suggestion.id})">Aceptar</button>
                        <button class="btn btn-danger" onclick="system.rejectSuggestion(${suggestion.id})">Rechazar</button>
                    </div>
                `;
            }

            div.innerHTML = `
                <div class="suggestion-header">
                    <span class="suggestion-title">${suggestion.title}</span>
                    <div>
                        <span class="suggestion-category" style="background: #dbeafe; color: #1e40af;">${suggestion.category}</span>
                        ${statusBadge}
                    </div>
                </div>
                <p style="color: #4b5563; font-size: 14px; margin: 8px 0;"><strong>Enviado por:</strong> ${suggestion.user}</p>
                <p style="color: #4b5563; font-size: 14px; margin: 8px 0;">${suggestion.description}</p>
                <small style="color: #9ca3af;">${suggestion.timestamp}</small>
                ${actionButtons}
            `;
            container.appendChild(div);
        });
    }

    async markBugAsFixed(bugId) {
        this.showLoader('Marcando bug como arreglado...');
        await this.randomDelay();

        const bugs = await this.getBugs();
        const bug = bugs.find(b => b.id === bugId);

        if (!bug) {
            this.hideLoader();
            alert('Bug no encontrado');
            return;
        }

        bug.status = 'fixed';
        await this.saveBugs(bugs);

        await this.addInternalNotification(bug.user, 'success', 'Bug Arreglado', `Tu reporte "${bug.title}" ha sido marcado como arreglado`);
        await this.addLog('bug', `Bug "${bug.title}" marcado como arreglado`);

        this.loadAdminBugs();
        this.hideLoader();
        alert('Bug marcado como arreglado. Se ha notificado al usuario.');
    }

    async acceptSuggestion(suggestionId) {
        this.showLoader('Aceptando sugerencia...');
        await this.randomDelay();

        const suggestions = await this.getSuggestions();
        const suggestion = suggestions.find(s => s.id === suggestionId);

        if (!suggestion) {
            this.hideLoader();
            alert('Sugerencia no encontrada');
            return;
        }

        suggestion.status = 'accepted';
        await this.saveSuggestions(suggestions);

        await this.addInternalNotification(suggestion.user, 'success', 'Sugerencia Aceptada', `Tu sugerencia "${suggestion.title}" ha sido aceptada`);
        await this.addLog('suggestion', `Sugerencia "${suggestion.title}" aceptada`);

        this.loadAdminSuggestions();
        this.hideLoader();
        alert('Sugerencia aceptada. Se ha notificado al usuario.');
    }

    async rejectSuggestion(suggestionId) {
        this.showLoader('Rechazando sugerencia...');
        await this.randomDelay();

        const suggestions = await this.getSuggestions();
        const suggestion = suggestions.find(s => s.id === suggestionId);

        if (!suggestion) {
            this.hideLoader();
            alert('Sugerencia no encontrada');
            return;
        }

        suggestion.status = 'rejected';
        await this.saveSuggestions(suggestions);

        await this.addLog('suggestion', `Sugerencia "${suggestion.title}" rechazada`);

        this.loadAdminSuggestions();
        this.hideLoader();
        alert('Sugerencia rechazada. No se ha notificado al usuario.');
    }

    async loadUserNotifications() {
        const notifications = (await this.getNotifications()).filter(n => n.recipient === this.currentUser.username);
        const container = document.getElementById('userNotificationsList');
        if (!container) return;

        container.innerHTML = '';

        if (notifications.length === 0) {
            container.innerHTML = '<p style="color: #666;">No tienes notificaciones</p>';
            return;
        }

        notifications.forEach((notif, index) => {
            const div = document.createElement('div');
            div.className = `notif-item ${notif.type} ${!notif.read ? 'unread' : ''}`;
            div.innerHTML = `
                <h4 style="margin: 0 0 8px 0; color: #111827; font-size: 16px;">${notif.title}</h4>
                <p style="color: #4b5563; font-size: 14px; margin: 8px 0;">${notif.message}</p>
                <small style="color: #9ca3af;">${notif.timestamp}</small>
            `;
            container.appendChild(div);
        });
    }

    async markAllNotificationsRead() {
        this.showLoader('Marcando notificaciones...');
        await this.randomDelay();

        const notifications = await this.getNotifications();
        notifications.forEach(n => {
            if (n.recipient === this.currentUser.username) {
                n.read = true;
            }
        });
        await this.saveNotifications(notifications);
        this.loadUserNotifications();
        this.hideLoader();
    }

    async clearUserNotifications() {
        if (confirm('¿Eliminar todas las notificaciones?')) {
            this.showLoader('Eliminando notificaciones...');
            await this.randomDelay();

            const notifications = (await this.getNotifications()).filter(n => n.recipient !== this.currentUser.username);
            await this.saveNotifications(notifications);
            this.loadUserNotifications();
            this.hideLoader();
        }
    }

    showInitialSetup() {
        document.getElementById('initialSetupContainer').classList.remove('hidden');
        document.getElementById('loginContainer').classList.add('hidden');
    }

    async completeInitialSetup() {
        const username = document.getElementById('setupUsername').value;
        const password = document.getElementById('setupPassword').value;
        const passwordConfirm = document.getElementById('setupPasswordConfirm').value;
        const robloxName = document.getElementById('setupRoblox').value;
        const errorDiv = document.getElementById('setupError');

        errorDiv.textContent = '';

        if (!username || !password || !passwordConfirm || !robloxName) {
            errorDiv.textContent = 'Por favor completa todos los campos';
            return;
        }

        if (!/^\d{4,6}$/.test(password)) {
            errorDiv.textContent = 'La contraseña debe ser de 4 a 6 dígitos';
            return;
        }

        if (password !== passwordConfirm) {
            errorDiv.textContent = 'Las contraseñas no coinciden';
            return;
        }

        this.showLoader('Creando cuenta de administrador...');
        await this.randomDelay();

        const defaultUser = {
            username,
            password: this.hashPassword(password),
            plainPassword: password,
            role: 'admin',
            robloxName,
            discord: null,
            isMainAdmin: true
        };

        await this.saveUsers([defaultUser]);

        this.initializeDefaultData();

        this.hideLoader();
        document.getElementById('initialSetupContainer').classList.add('hidden');
        document.getElementById('loginContainer').classList.remove('hidden');

        alert('Cuenta de administrador creada correctamente. Ahora puedes iniciar sesión.');
    }

    togglePassword(username) {
        const pwdElement = document.getElementById(`pwd_${username}`);
        const hiddenElement = document.getElementById(`pwd_hidden_${username}`);

        if (pwdElement && hiddenElement) {
            if (pwdElement.style.display === 'none') {
                pwdElement.style.display = 'inline';
                hiddenElement.style.display = 'none';
            } else {
                pwdElement.style.display = 'none';
                hiddenElement.style.display = 'inline';
            }
        }
    }

}

(function() {
    const system = new BetaTestersSystem();

    window.system = {
        editAccount: (username) => system.editAccount(username),
        approveRequest: (id) => system.approveRequest(id),
        rejectRequest: (id) => system.rejectRequest(id),
        togglePassword: (username) => system.togglePassword(username),
        markBugAsFixed: (id) => system.markBugAsFixed(id),
        acceptSuggestion: (id) => system.acceptSuggestion(id),
        rejectSuggestion: (id) => system.rejectSuggestion(id)
    };
})();
