const CONFIG = {
  business: { name: 'Wash and Dash Laundry Services', tagline: 'The faster way to a fresher day', phone: '0948 168 6312', facebook: 'Grab and Wash' },
  rates: { standardMin: 60, standardMax: 70, standardRate: 70, premiumMin: 90, premiumMax: 100, premiumRate: 100, express: 120, ironing: 15, bedding: 175, eco: 10 },
  packages: { family: { name: 'Family Package', price: 600, weight: 10 }, professional: { name: 'Professional Package', price: 350, weight: 5 }, corporate: { name: 'Corporate Package', price: 0, weight: 0 } },
  delivery: { freeMinimum: 300, fee: 40, minFee: 30, maxFee: 50 },
  capacity: { morning: 5, afternoon: 5 },
  slots: { morning: { label: 'Morning', time: '8:00 AM – 11:00 AM' }, afternoon: { label: 'Afternoon', time: '12:00 PM – 4:00 PM' } },
  subscription: 500
};

const STORAGE_KEY = 'washDashBookings';
const state = {
  step: 1, service: 'standard', weight: 5, ironing: 0, bedding: 0, eco: false,
  date: '', timeSlot: '', payment: 'GCash', details: {}, calendarDate: new Date()
};
const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
const money = value => `₱${Math.round(value).toLocaleString('en-PH')}`;
const bookings = () => JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
const saveBookings = list => localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
const dateKey = date => date.toISOString().slice(0, 10);
const parseDate = key => new Date(`${key}T00:00:00`);
const todayKey = () => dateKey(new Date());
const readableDate = key => key ? parseDate(key).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not selected';

function getServiceLabel(key = state.service) {
  return { standard: 'Standard Wash, Dry & Fold', premium: 'Premium Care', express: 'Express Service', family: 'Family Package', professional: 'Professional Package', corporate: 'Corporate Package' }[key];
}
function serviceFee() {
  if (state.service === 'standard') return state.weight * CONFIG.rates.standardRate;
  if (state.service === 'premium') return state.weight * CONFIG.rates.premiumRate;
  if (state.service === 'express') return state.weight * CONFIG.rates.express;
  if (state.service === 'family') return CONFIG.packages.family.price;
  if (state.service === 'professional') return CONFIG.packages.professional.price;
  return 0;
}
function calculateTotal() {
  const service = serviceFee();
  const addOns = (state.ironing * CONFIG.rates.ironing) + (state.bedding * CONFIG.rates.bedding) + (state.eco ? state.weight * CONFIG.rates.eco : 0);
  const delivery = service + addOns >= CONFIG.delivery.freeMinimum ? 0 : CONFIG.delivery.fee;
  return { service, addOns, delivery, total: service + addOns + delivery };
}
function getSlotBookings(date, slot) {
  return bookings().filter(booking => booking.date === date && booking.timeSlot === slot && booking.status !== 'Cancelled').length;
}
function slotFull(date, slot) {
  return getSlotBookings(date, slot) >= CONFIG.capacity[slot];
}
function isPast(key) { return key < todayKey(); }

function setService(service) {
  state.service = service;
  if (service === 'family') state.weight = CONFIG.packages.family.weight;
  if (service === 'professional') state.weight = CONFIG.packages.professional.weight;
  renderServiceChoices();
  renderWeight();
  renderCalendar();
}
function renderServiceChoices() {
  $$('.choice-card').forEach(card => card.classList.toggle('selected', card.dataset.choice === state.service));
  const weightControl = $('#weightControl');
  weightControl.classList.toggle('hidden', state.service === 'corporate');
}
function renderWeight() { $('#weightValue').textContent = `${state.weight} kg`; }
function changeWeight(delta) {
  if (['family', 'professional'].includes(state.service)) return;
  state.weight = Math.max(1, Math.min(50, state.weight + delta));
  renderWeight();
}
function changeQuantity(kind, delta) {
  state[kind] = Math.max(0, Math.min(50, state[kind] + delta));
  $(`#${kind === 'ironing' ? 'ironingValue' : 'beddingValue'}`).textContent = state[kind];
}
function renderAddons() {
  $$('[data-addon]').forEach(input => input.checked = input.dataset.addon === 'eco' ? state.eco : state[input.dataset.addon] > 0);
  $$('[data-quantity]').forEach(row => row.classList.toggle('hidden', state[row.dataset.quantity] === 0));
  $('#ironingValue').textContent = state.ironing;
  $('#beddingValue').textContent = state.bedding;
}

function monthTitle(date) { return date.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' }); }
function renderCalendar() {
  const calendar = $('#calendarGrid');
  if (!calendar) return;
  const year = state.calendarDate.getFullYear();
  const month = state.calendarDate.getMonth();
  $('#calendarTitle').textContent = monthTitle(state.calendarDate);
  calendar.innerHTML = '';
  const firstDay = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const previousDays = new Date(year, month, 0).getDate();
  for (let index = 0; index < 42; index += 1) {
    const day = index - firstDay + 1;
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'calendar-day';
    let cellDate;
    if (day < 1) { cellDate = new Date(year, month - 1, previousDays + day); cell.classList.add('other-month'); }
    else if (day > days) { cellDate = new Date(year, month + 1, day - days); cell.classList.add('other-month'); }
    else cellDate = new Date(year, month, day);
    const key = dateKey(cellDate);
    cell.textContent = cellDate.getDate();
    const unavailable = isPast(key) || cell.classList.contains('other-month');
    const bothFull = slotFull(key, 'morning') && slotFull(key, 'afternoon');
    if (unavailable) { cell.disabled = true; cell.classList.add('past'); }
    else if (bothFull) { cell.disabled = true; cell.classList.add('full'); cell.setAttribute('aria-label', `${readableDate(key)} fully booked`); }
    else { cell.classList.add('available'); cell.setAttribute('aria-label', `${readableDate(key)} available`); cell.addEventListener('click', () => selectDate(key)); }
    if (key === state.date) cell.classList.add('selected');
    calendar.appendChild(cell);
  }
  renderSlots();
}
function selectDate(key) {
  if (isPast(key)) return;
  state.date = key;
  state.timeSlot = '';
  renderCalendar();
}
function renderSlots() {
  const list = $('#slotList');
  if (!list) return;
  if (!state.date) { $('#selectedDateLabel').textContent = 'Select a date'; list.innerHTML = '<p class="empty-slot">Choose a blue date to see slots.</p>'; return; }
  $('#selectedDateLabel').textContent = readableDate(state.date);
  list.innerHTML = Object.entries(CONFIG.slots).map(([key, slot]) => {
    const full = slotFull(state.date, key);
    const selected = state.timeSlot === key;
    const count = getSlotBookings(state.date, key);
    return `<button type="button" class="slot-button ${full ? 'full' : 'available'} ${selected ? 'selected' : ''}" data-slot="${key}" ${full ? 'disabled' : ''}><strong>${slot.label}</strong><small>${slot.time}</small><span class="slot-status">${full ? 'Fully booked' : `${CONFIG.capacity[key] - count} slots available`}</span></button>`;
  }).join('');
  $$('.slot-button:not(:disabled)').forEach(button => button.addEventListener('click', () => { state.timeSlot = button.dataset.slot; renderSlots(); }));
}
function validateSchedule() {
  if (!state.date) return showToast('Please select a pickup date.');
  if (!state.timeSlot) return showToast('Please select an available time slot.');
  if (slotFull(state.date, state.timeSlot)) { showToast('That slot just filled up. Please choose another.'); renderCalendar(); return false; }
  return true;
}
function validateDetails() {
  const form = $('#detailsForm');
  let valid = true;
  const messages = { name: 'Please enter your full name.', phone: 'Please enter your mobile number.', email: 'Please enter your email address.', pickupAddress: 'Please enter your pickup address.', deliveryAddress: 'Please enter your delivery address.' };
  ['name', 'phone', 'email', 'pickupAddress', 'deliveryAddress'].forEach(name => {
    const input = form.elements[name];
    const error = input.parentElement.querySelector('.error-message');
    const empty = !input.value.trim();
    const badEmail = name === 'email' && input.value.trim() && !/^\S+@\S+\.\S+$/.test(input.value.trim());
    error.textContent = empty || badEmail ? (badEmail ? 'Please enter a valid email address.' : messages[name]) : '';
    if (empty || badEmail) valid = false;
  });
  if (valid) state.details = Object.fromEntries(new FormData(form).entries());
  return valid;
}
function renderSummary() {
  const totals = calculateTotal();
  const addOnText = [state.ironing ? `Ironing (${state.ironing} pieces)` : '', state.bedding ? `Bedding & curtains (${state.bedding} sets)` : '', state.eco ? 'Eco-friendly detergent' : ''].filter(Boolean).join(', ') || 'None';
  $('#summaryList').innerHTML = `<div class="summary-block"><h4>Customer</h4><p><span>Full name</span>${state.details.name}</p><p><span>Mobile</span>${state.details.phone}</p><p><span>Email</span>${state.details.email}</p></div><div class="summary-block"><h4>Service</h4><p><span>Selected service</span>${getServiceLabel()}</p><p><span>Laundry weight</span>${state.weight} kg</p><p><span>Add-ons</span>${addOnText}</p></div><div class="summary-block"><h4>Schedule & address</h4><p><span>Pickup date</span>${readableDate(state.date)}</p><p><span>Pickup time</span>${CONFIG.slots[state.timeSlot]?.time || 'Not selected'}</p><p><span>Pickup address</span>${state.details.pickupAddress}</p><p><span>Delivery address</span>${state.details.deliveryAddress}</p></div><div class="summary-block"><h4>Payment</h4><p><span>Preferred method</span>${state.payment}</p></div>`;
  $('#summaryTotal').textContent = money(totals.total);
  $('#deliverySummary').textContent = totals.delivery === 0 ? 'Free delivery applied to this order.' : `${money(totals.delivery)} delivery fee · Orders over ${money(CONFIG.delivery.freeMinimum)} are free.`;
}
function setStep(nextStep) {
  state.step = nextStep;
  $$('.booking-step').forEach(step => step.classList.toggle('hidden', Number(step.dataset.step) !== nextStep));
  $$('.progress-list li').forEach((item, index) => item.classList.toggle('active', index < nextStep));
  if (nextStep === 2) renderAddons();
  if (nextStep === 3) renderCalendar();
  if (nextStep === 6) renderSummary();
  $('#booking').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function nextStep() {
  if (state.step === 3 && !validateSchedule()) return;
  if (state.step === 4 && !validateDetails()) return;
  if (state.step < 6) setStep(state.step + 1);
}
function resetBooking() {
  Object.assign(state, { step: 1, service: 'standard', weight: 5, ironing: 0, bedding: 0, eco: false, date: '', timeSlot: '', payment: 'GCash', details: {}, calendarDate: new Date() });
  $('#confirmation').classList.add('hidden');
  $$('.booking-step').forEach(step => step.classList.remove('hidden'));
  renderServiceChoices(); renderWeight(); renderAddons(); setStep(1);
}
function createBooking() {
  if (!validateSchedule()) return;
  const totals = calculateTotal();
  const list = bookings();
  if (slotFull(state.date, state.timeSlot)) return showToast('This slot is now fully booked. Please choose another.');
  const reference = `WD-${new Date().getFullYear()}-${String(list.length + 1).padStart(4, '0')}`;
  const booking = { id: reference, customer: state.details.name, phone: state.details.phone, email: state.details.email, pickupAddress: state.details.pickupAddress, deliveryAddress: state.details.deliveryAddress, instructions: state.details.instructions || '', service: getServiceLabel(), serviceKey: state.service, weight: state.weight, addOns: { ironing: state.ironing, bedding: state.bedding, eco: state.eco }, date: state.date, timeSlot: state.timeSlot, time: CONFIG.slots[state.timeSlot].time, payment: state.payment, serviceFee: totals.service, addOnFees: totals.addOns, deliveryFee: totals.delivery, total: totals.total, status: 'Pending', createdAt: new Date().toISOString() };
  list.push(booking); saveBookings(list);
  $('#confirmationReference').textContent = reference;
  $('#confirmationDetails').innerHTML = `<div><span>Customer</span><strong>${booking.customer}</strong></div><div><span>Service</span><strong>${booking.service}</strong></div><div><span>Pickup</span><strong>${readableDate(booking.date)} · ${booking.timeSlot === 'morning' ? 'Morning' : 'Afternoon'}</strong></div><div><span>Total</span><strong>${money(booking.total)}</strong></div>`;
  $$('.booking-step').forEach(step => step.classList.add('hidden'));
  $('.booking-sidebar').classList.add('hidden');
  $('#confirmation').classList.remove('hidden');
  $('#booking').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function showToast(message) {
  let toast = $('#toast');
  if (!toast) { toast = document.createElement('div'); toast.id = 'toast'; toast.className = 'toast'; document.body.appendChild(toast); }
  toast.textContent = message; toast.classList.add('show');
  window.clearTimeout(showToast.timer); showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 3000);
}
function renderAdmin(tab = 'overview') {
  const list = bookings().sort((a, b) => `${a.date}${a.timeSlot}`.localeCompare(`${b.date}${b.timeSlot}`));
  const panel = $('#adminPanel');
  $$('.admin-tab').forEach(button => button.classList.toggle('active', button.dataset.adminTab === tab));
  if (tab === 'overview') {
    const today = list.filter(booking => booking.date === todayKey());
    panel.innerHTML = `<div class="admin-overview"><div class="stat-card"><span>Today's bookings</span><strong>${today.length}</strong></div><div class="stat-card"><span>Upcoming bookings</span><strong>${list.filter(booking => booking.date >= todayKey()).length}</strong></div><div class="stat-card"><span>Pending confirmation</span><strong>${list.filter(booking => booking.status === 'Pending').length}</strong></div><div class="stat-card"><span>Revenue requested</span><strong>${money(list.reduce((sum, item) => sum + item.total, 0))}</strong></div></div>${adminTable(list)}`;
  } else if (tab === 'calendar') {
    panel.innerHTML = `<div class="calendar-card"><div class="calendar-head"><strong>Booking calendar</strong><span class="mini-label">${list.length} total requests</span></div><div class="admin-calendar-list">${list.length ? list.map(booking => `<div class="slot-admin-row"><span><strong>${readableDate(booking.date)}</strong><br>${booking.customer} · ${booking.timeSlot === 'morning' ? 'Morning' : 'Afternoon'}</span><span class="${booking.status === 'Cancelled' ? 'status-full' : 'status-good'}">${booking.status}</span></div>`).join('') : '<div class="admin-empty">No bookings have been placed yet.</div>'}</div></div>`;
  } else {
    const baseDate = list[0]?.date || todayKey();
    panel.innerHTML = `<div class="slot-management"><div class="slot-admin-card"><span class="mini-label">Selected day</span><h4>${readableDate(baseDate)}</h4>${adminSlotRow(baseDate, 'morning')}${adminSlotRow(baseDate, 'afternoon')}</div><div class="slot-admin-card"><span class="mini-label">Capacity rules</span><h4>Configurable limits</h4><p class="muted-copy">Morning capacity: <strong>${CONFIG.capacity.morning}</strong> bookings</p><p class="muted-copy">Afternoon capacity: <strong>${CONFIG.capacity.afternoon}</strong> bookings</p><p class="muted-copy">Update these values in the central CONFIG object when your team is ready.</p></div></div>`;
  }
}
function adminSlotRow(date, slot) { const count = getSlotBookings(date, slot); const full = slotFull(date, slot); return `<div class="slot-admin-row"><span>${CONFIG.slots[slot].label}<br><small>${CONFIG.slots[slot].time}</small></span><span class="${full ? 'status-full' : 'status-good'}">${full ? 'Fully booked' : `${count} / ${CONFIG.capacity[slot]} booked`}</span></div>`; }
function adminTable(list) {
  if (!list.length) return '<div class="admin-empty">No bookings yet. A confirmed customer booking will appear here.</div>';
  const statuses = ['Pending', 'Confirmed', 'Pickup Scheduled', 'Laundry Processing', 'Ready for Delivery', 'Delivered', 'Completed', 'Cancelled'];
  return `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Booking ID</th><th>Customer</th><th>Service</th><th>Weight</th><th>Pickup time</th><th>Status</th><th>Total</th></tr></thead><tbody>${list.map(booking => `<tr><td><strong>${booking.id}</strong></td><td>${booking.customer}</td><td>${booking.service}</td><td>${booking.weight} kg</td><td>${readableDate(booking.date)}<br>${booking.timeSlot}</td><td><select class="status-select" data-status-id="${booking.id}">${statuses.map(status => `<option ${status === booking.status ? 'selected' : ''}>${status}</option>`).join('')}</select></td><td><strong>${money(booking.total)}</strong></td></tr>`).join('')}</tbody></table></div>`;
}
function init() {
  renderServiceChoices(); renderWeight(); renderAddons(); renderCalendar(); renderAdmin();
  $$('[data-go-booking]').forEach(button => button.addEventListener('click', () => { setStep(1); document.querySelector('#booking').scrollIntoView({ behavior: 'smooth' }); }));
  $$('[data-service]').forEach(button => button.addEventListener('click', () => { setService(button.dataset.service); setStep(1); document.querySelector('#booking').scrollIntoView({ behavior: 'smooth' }); }));
  $$('[data-package]').forEach(button => button.addEventListener('click', () => { setService(button.dataset.package); setStep(1); document.querySelector('#booking').scrollIntoView({ behavior: 'smooth' }); }));
  $$('.choice-card').forEach(button => button.addEventListener('click', () => setService(button.dataset.choice)));
  $$('[data-next]').forEach(button => button.addEventListener('click', nextStep));
  $$('[data-back]').forEach(button => button.addEventListener('click', () => setStep(Math.max(1, state.step - 1))));
  $$('[data-weight]').forEach(button => button.addEventListener('click', () => changeWeight(button.dataset.weight === 'plus' ? 1 : -1)));
  $$('[data-ironing],[data-bedding]').forEach(button => button.addEventListener('click', () => changeQuantity(button.dataset.ironing ? 'ironing' : 'bedding', button.dataset.ironing === 'plus' || button.dataset.bedding === 'plus' ? 1 : -1)));
  $$('[data-addon]').forEach(input => input.addEventListener('change', () => { const type = input.dataset.addon; if (type === 'eco') state.eco = input.checked; else state[type] = input.checked ? 1 : 0; renderAddons(); }));
  $$('.payment-card').forEach(button => button.addEventListener('click', () => { state.payment = button.dataset.payment; $$('.payment-card').forEach(card => card.classList.toggle('selected', card === button)); }));
  $('#prevMonth').addEventListener('click', () => { state.calendarDate.setMonth(state.calendarDate.getMonth() - 1); renderCalendar(); });
  $('#nextMonth').addEventListener('click', () => { state.calendarDate.setMonth(state.calendarDate.getMonth() + 1); renderCalendar(); });
  $('#confirmBooking').addEventListener('click', createBooking);
  $('#viewBookingBtn').addEventListener('click', () => { renderAdmin(); document.querySelector('#admin').scrollIntoView({ behavior: 'smooth' }); });
  $('[data-go-home]').addEventListener('click', () => { resetBooking(); document.querySelector('#home').scrollIntoView({ behavior: 'smooth' }); });
  $('#adminLink').addEventListener('click', () => document.querySelector('#admin').scrollIntoView({ behavior: 'smooth' }));
  $$('.admin-tab').forEach(button => button.addEventListener('click', () => renderAdmin(button.dataset.adminTab)));
  $('#adminPanel').addEventListener('change', event => { if (!event.target.matches('[data-status-id]')) return; const list = bookings(); const booking = list.find(item => item.id === event.target.dataset.statusId); if (booking) { booking.status = event.target.value; saveBookings(list); renderAdmin(); showToast('Booking status updated.'); } });
  $('#menuToggle').addEventListener('click', () => { const nav = $('#mainNav'); const open = nav.classList.toggle('open'); $('#menuToggle').setAttribute('aria-expanded', open); });
  $$('#mainNav a').forEach(link => link.addEventListener('click', () => $('#mainNav').classList.remove('open')));
  const modal = $('#infoModal'); $('#subscribeBtn').addEventListener('click', () => modal.classList.remove('hidden')); $('#modalClose').addEventListener('click', () => modal.classList.add('hidden')); modal.addEventListener('click', event => { if (event.target === modal) modal.classList.add('hidden'); });
}

document.addEventListener('DOMContentLoaded', init);
