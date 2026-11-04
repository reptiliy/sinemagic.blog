const accountStyles = document.createElement('link');
accountStyles.rel = 'stylesheet';
accountStyles.href = '/account.css';
document.head.append(accountStyles);
const platformConfig = location.protocol === 'file:'
 ? Promise.resolve({})
 : fetch('/api/config').then(response => response.json()).catch(() => ({}));
const tokenKey = 'journal.session';

async function journalApi(path, method = 'GET', body) {
 const token = sessionStorage.getItem(tokenKey);
 const response = await fetch(path, {
  method,
  headers: {'Content-Type': 'application/json', ...(token ? {Authorization: 'Bearer ' + token} : {})},
  body: body && JSON.stringify(body)
 });
 const value = await response.json();
 if (!response.ok) {
  if (response.status === 401) sessionStorage.removeItem(tokenKey);
  throw Object.assign(new Error(value.error), {status: response.status});
 }
 return value;
}

function account() {
 if (document.querySelector('.account-dialog')) return;
 const dialog = document.createElement('dialog');
 dialog.className = 'account-dialog';
 dialog.setAttribute('aria-labelledby', 'account-title');
 dialog.innerHTML = `<button type="button" class="account-close" aria-label="Закрыть окно">×</button>
  <div class="account-symbol" aria-hidden="true">✦</div>
  <p class="account-kicker">ВАШ ЛИЧНЫЙ КАБИНЕТ</p>
  <h2 id="account-title">С возвращением</h2>
  <p class="account-intro">Войдите, чтобы читать статьи и управлять подпиской.</p>
  <div class="account-tabs" aria-label="Режим входа">
   <button type="button" data-mode="login" aria-pressed="true">Вход</button>
   <button type="button" data-mode="register" aria-pressed="false">Регистрация</button>
  </div>
  <form class="account-form">
   <label for="account-email">Электронная почта</label>
   <input id="account-email" name="email" type="email" placeholder="you@example.com" autocomplete="email" required>
   <label for="account-password">Пароль</label>
   <input id="account-password" name="password" type="password" placeholder="Введите пароль" autocomplete="current-password" required minlength="6">
   <p class="account-status" role="status" aria-live="polite"></p>
   <button type="submit" class="account-submit">Войти →</button>
  </form>
  <p class="account-note">Ваши статьи и подписка — в одном аккаунте.</p>`;
 document.body.append(dialog);
 const heading = dialog.querySelector('h2');
 const intro = dialog.querySelector('.account-intro');
 const tabs = dialog.querySelector('.account-tabs');
 const form = dialog.querySelector('form');
 const status = dialog.querySelector('.account-status');
 const submit = dialog.querySelector('.account-submit');
 let signup = false;
 let busy = false;
 dialog.querySelector('.account-close').onclick = () => dialog.close();
 dialog.onclose = () => dialog.remove();
 dialog.onclick = event => {
  if (event.target !== dialog) return;
  const bounds = dialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
 };
 dialog.showModal();
 if (sessionStorage.getItem(tokenKey)) {
  heading.textContent = 'Ваш аккаунт';
  intro.textContent = 'Вы вошли в журнал.';
  tabs.remove();
  form.replaceChildren(submit);
  submit.textContent = 'Выйти из аккаунта';
  form.onsubmit = event => {
   event.preventDefault();
   sessionStorage.removeItem(tokenKey);
   location.reload();
  };
  return;
 }
 for (const button of tabs.querySelectorAll('button')) {
  button.onclick = () => {
   if (busy) return;
   signup = button.dataset.mode === 'register';
   heading.textContent = signup ? 'Присоединяйтесь' : 'С возвращением';
   intro.textContent = signup ? 'Создайте аккаунт для доступа к журналу и подписке.' : 'Войдите, чтобы читать статьи и управлять подпиской.';
   submit.textContent = signup ? 'Создать аккаунт →' : 'Войти →';
   form.elements.password.autocomplete = signup ? 'new-password' : 'current-password';
   status.textContent = '';
   for (const tab of tabs.querySelectorAll('button')) tab.setAttribute('aria-pressed', String(tab === button));
  };
 }
 form.onsubmit = async event => {
  event.preventDefault();
  if (busy) return;
  busy = true;
  submit.disabled = true;
  tabs.querySelectorAll('button').forEach(button => button.disabled = true);
  const label = submit.textContent;
  submit.textContent = 'Подождите…';
  status.textContent = '';
  try {
   const config = await platformConfig;
   if (!config.connected) throw Error('Вход временно недоступен. Попробуйте позже.');
   const response = await fetch(config.url + '/auth/v1/' + (signup ? 'signup' : 'token?grant_type=password'), {
    method: 'POST',
    headers: {apikey: config.key, 'Content-Type': 'application/json'},
    body: JSON.stringify({email: form.elements.email.value.trim(), password: form.elements.password.value}),
    signal: AbortSignal.timeout(20000)
   });
   const result = await response.json();
   if (!response.ok) throw Error(signup ? 'Не удалось создать аккаунт. Проверьте данные или попробуйте войти.' : 'Проверьте почту, пароль и подтверждение адреса.');
   if (!result.access_token) {
    status.textContent = 'Мы отправили письмо. Подтвердите адрес и вернитесь для входа.';
    return;
   }
   sessionStorage.setItem(tokenKey, result.access_token);
   location.reload();
  } catch (error) {
   status.textContent = error.name === 'TimeoutError' || error instanceof TypeError ? 'Не удалось связаться с сервером. Попробуйте ещё раз.' : error.message;
  } finally {
   busy = false;
   submit.disabled = false;
   submit.textContent = label;
   tabs.querySelectorAll('button').forEach(button => button.disabled = false);
  }
 };
 form.elements.email.focus();
}
const login = document.querySelector('#login');
if (login) {
 login.onclick = account;
 if (sessionStorage.getItem(tokenKey)) login.textContent = 'Аккаунт ↗';
}
