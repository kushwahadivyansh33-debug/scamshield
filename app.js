"use strict";

const cropData = {
  tomato: {
    name: "tomatoes",
    icon: "🍅",
    price: "₹ 1,840",
    change: "8.2%",
    arrivals: "12 farmers",
    arrivalLevel: "Low",
    recommendation: "tomorrow morning",
    copy: "Prices are trending up, and fewer nearby farms plan to bring tomatoes tomorrow. Picking early keeps quality high in the cooler hours.",
    insight: "Prices may rise 5–8% by Thursday.",
    values: [124, 132, 91, 102, 118, 88, 104, 71, 85, 56, 76, 43, 29],
  },
  onion: {
    name: "onions",
    icon: "🧅",
    price: "₹ 2,160",
    change: "3.6%",
    arrivals: "18 farmers",
    arrivalLevel: "Medium",
    recommendation: "Thursday morning",
    copy: "Onion prices are holding steady, with a small lift expected later this week. Keep harvested bulbs dry and well-ventilated while you wait for a good rate.",
    insight: "Prices look steady, with a small lift expected.",
    values: [106, 100, 116, 95, 106, 93, 100, 82, 87, 69, 82, 59, 53],
  },
  grapes: {
    name: "grapes",
    icon: "🍇",
    price: "₹ 3,420",
    change: "5.1%",
    arrivals: "9 farmers",
    arrivalLevel: "Low",
    recommendation: "tomorrow at first light",
    copy: "Grape demand is firm and nearby arrivals are light. Pick only dry bunches in the cool morning, then move them gently to avoid bruising.",
    insight: "Demand is firm and nearby arrivals remain light.",
    values: [136, 120, 127, 109, 120, 90, 99, 80, 91, 63, 66, 48, 36],
  },
};

const marketAdjustments = {
  lasalgaon: { label: "Lasalgaon APMC", delta: 0, change: 0 },
  pimpalgaon: { label: "Pimpalgaon Baswant", delta: 120, change: -1.1 },
  nashik: { label: "Nashik Market", delta: -85, change: 0.7 },
};

const planStorageKey = "harvestwindow-plans";
const cropSelect = document.querySelector("#crop-select");
const marketSelect = document.querySelector("#market-select");
const plannerMarket = document.querySelector("#planner-market");
const harvestDateInput = document.querySelector("#harvest-date");
const harvestQuantityInput = document.querySelector("#harvest-quantity");
const grossEstimate = document.querySelector("#gross-estimate");
const plannerStatus = document.querySelector("#planner-status");
const savedPlansList = document.querySelector("#saved-plans-list");
const logCount = document.querySelector("#log-count");
const logNote = document.querySelector("#log-note");
const priceValue = document.querySelector("#price-value");
const priceChange = document.querySelector("#price-change");
const arrivalValue = document.querySelector("#arrival-value");
const arrivalCaption = document.querySelector("#arrival-caption");
const cropIcon = document.querySelector(".crop-icon");
const recommendationDay = document.querySelector("#recommendation-day");
const recommendationCopy = document.querySelector("#recommendation-copy");
const chartLine = document.querySelector("#chart-line");
const chartArea = document.querySelector("#chart-area");
const chartForecast = document.querySelector("#chart-forecast");
const chartCallout = document.querySelector(".chart-callout");
const chartInsight = document.querySelector(".chart-insight strong");
const checklist = document.querySelector("#checklist");
const checkProgressLabel = document.querySelector("#check-progress-label");
const checkProgressBar = document.querySelector("#check-progress-bar");
const toast = document.querySelector("#toast");
const shareDialog = document.querySelector("#share-dialog");
const shareMessage = document.querySelector("#share-message");
const shareStatus = document.querySelector("#share-status");
const checkoutDialog = document.querySelector("#checkout-dialog");
const checkoutPlanName = document.querySelector("#checkout-plan-name");
const checkoutPlanPrice = document.querySelector("#checkout-plan-price");
const checkoutBillingNote = document.querySelector("#checkout-billing-note");
const billingMonthlyButton = document.querySelector("#billing-monthly");
const billingYearlyButton = document.querySelector("#billing-yearly");
const planNames = { free: "Free", smart: "Smart Farmer", fpo: "FPO Pro" };
let toastTimeout;
let weekExpanded = false;
let savedPlans = [];
let billingPeriod = "monthly";
let pendingPlan = null;
let selectedPlan = "free";

function formatDate(date, options) {
  return new Intl.DateTimeFormat("en-IN", options).format(date);
}

function updateDates() {
  const today = new Date();
  document.querySelector("#today-date").textContent = formatDate(today, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).toUpperCase();

  const chartDates = document.querySelectorAll(".x-labels span");
  chartDates.forEach((label, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index - 2);
    label.textContent = index === 2 ? "Today" : formatDate(date, { month: "short", day: "2-digit" });
  });

  document.querySelectorAll(".window-date").forEach((dateElement, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index + 1);
    dateElement.querySelector("strong").textContent = formatDate(date, { day: "2-digit" });
    dateElement.querySelector("span").textContent = formatDate(date, { weekday: "short" }).toUpperCase();
  });
}

function parseRupees(value) {
  return Number(value.replace(/[^\d]/g, ""));
}

function formatRupees(value) {
  return `₹ ${new Intl.NumberFormat("en-IN").format(value)}`;
}

function getLocalDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getPlannerPrice() {
  return parseRupees(cropData[cropSelect.value].price) + marketAdjustments[plannerMarket.value].delta;
}

function updateGrossEstimate() {
  const quantity = Number(harvestQuantityInput.value);
  const price = getPlannerPrice();
  grossEstimate.textContent = Number.isFinite(quantity) && quantity > 0
    ? formatRupees(price * quantity)
    : "—";
}

function setPlannerStatus(message, state = "") {
  plannerStatus.textContent = message;
  if (state) plannerStatus.dataset.state = state;
  else delete plannerStatus.dataset.state;
}

function setLogNote(message) {
  logNote.textContent = message;
}

function isValidPlan(plan) {
  const parsedDate = plan && typeof plan.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(plan.date)
    ? new Date(`${plan.date}T00:00:00`)
    : null;
  return plan
    && typeof plan === "object"
    && typeof plan.id === "string"
    && parsedDate instanceof Date
    && !Number.isNaN(parsedDate.getTime())
    && getLocalDateString(parsedDate) === plan.date
    && Number.isFinite(plan.quantity)
    && plan.quantity >= 1
    && plan.quantity <= 2000
    && Object.hasOwn(cropData, plan.crop)
    && Object.hasOwn(marketAdjustments, plan.market)
    && Number.isFinite(plan.price)
    && Number.isFinite(plan.total)
    && plan.total === plan.price * plan.quantity;
}

function loadSavedPlans() {
  try {
    const rawPlans = localStorage.getItem(planStorageKey);
    if (rawPlans === null) return [];
    const parsedPlans = JSON.parse(rawPlans);
    if (!Array.isArray(parsedPlans) || !parsedPlans.every(isValidPlan)) {
      setLogNote("Saved plan data is invalid and was not loaded.");
      return [];
    }
    return parsedPlans.slice(0, 20);
  } catch (error) {
    if (error instanceof DOMException && error.name === "SecurityError") {
      setLogNote("Browser storage is unavailable. Plans cannot be loaded or saved in this session.");
      return [];
    }
    if (error instanceof SyntaxError) {
      setLogNote("Saved plan data could not be read. Clear the browser's HarvestWindow plan data to start a new log.");
      return [];
    }
    throw error;
  }
}

function renderSavedPlans() {
  savedPlansList.replaceChildren();
  logCount.textContent = `${savedPlans.length} ${savedPlans.length === 1 ? "plan" : "plans"}`;

  if (!savedPlans.length) {
    const emptyMessage = document.createElement("div");
    emptyMessage.className = "empty-log";
    const icon = document.createElement("span");
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "▤";
    const title = document.createElement("strong");
    title.textContent = "No harvest plans yet";
    const detail = document.createElement("span");
    detail.textContent = "Save a plan to start your log.";
    emptyMessage.append(icon, title, detail);
    savedPlansList.append(emptyMessage);
    return;
  }

  savedPlans.forEach((plan) => {
    const item = document.createElement("article");
    item.className = "saved-plan-entry";
    const title = document.createElement("strong");
    title.textContent = `${cropData[plan.crop].name[0].toUpperCase()}${cropData[plan.crop].name.slice(1)} · ${formatDate(new Date(`${plan.date}T00:00:00`), {
      day: "numeric",
      month: "short",
    })}`;
    const details = document.createElement("span");
    details.textContent = `${plan.quantity} quintals · ${marketAdjustments[plan.market].label}`;
    const total = document.createElement("span");
    total.className = "saved-plan-total";
    total.textContent = formatRupees(plan.total);
    item.append(title, details, total);
    savedPlansList.append(item);
  });
}

function saveHarvestPlan(event) {
  event.preventDefault();
  setPlannerStatus("");
  const quantity = Number(harvestQuantityInput.value);
  const date = harvestDateInput.value;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 2000) {
    setPlannerStatus("Enter a quantity from 1 to 2,000 quintals.", "error");
    harvestQuantityInput.focus();
    return;
  }
  if (!date || date < getLocalDateString(tomorrow)) {
    setPlannerStatus("Choose a harvest date starting tomorrow.", "error");
    harvestDateInput.focus();
    return;
  }

  const price = getPlannerPrice();
  const plan = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date,
    quantity,
    crop: cropSelect.value,
    market: plannerMarket.value,
    price,
    total: price * quantity,
  };
  const nextPlans = [plan, ...savedPlans].slice(0, 20);
  try {
    localStorage.setItem(planStorageKey, JSON.stringify(nextPlans));
  } catch (error) {
    if (error instanceof DOMException && (error.name === "SecurityError" || error.name === "QuotaExceededError")) {
      setPlannerStatus("This browser could not save your plan. Check storage permissions and try again.", "error");
      return;
    }
    throw error;
  }

  savedPlans = nextPlans;
  renderSavedPlans();
  setPlannerStatus("Plan saved on this device.");
}

function makeShareMessage() {
  const date = harvestDateInput.value
    ? formatDate(new Date(`${harvestDateInput.value}T00:00:00`), { weekday: "short", day: "numeric", month: "short" })
    : "date not set";
  const quantity = Number(harvestQuantityInput.value);
  const amount = Number.isInteger(quantity) && quantity > 0 ? `${quantity} quintals` : "quantity not set";
  return `Harvest plan near Nashik: ${amount} of ${cropData[cropSelect.value].name}, planned for ${date}. Considering ${marketAdjustments[plannerMarket.value].label}. Shared from HarvestWindow; timing and prices are estimates.`;
}

function setShareStatus(message, state = "") {
  shareStatus.textContent = message;
  if (state) shareStatus.dataset.state = state;
  else delete shareStatus.dataset.state;
}

function setChartLine(values) {
  const points = values.map((value, index) => ({
    x: (620 / (values.length - 1)) * index,
    y: value,
  }));
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`).join(" ");
  const currentPoint = points[2];
  const lastPoint = points[points.length - 1];
  chartLine.setAttribute("d", path);
  chartArea.setAttribute("d", `${path} L620 164 L0 164 Z`);
  chartForecast.setAttribute("d", `M${currentPoint.x} ${currentPoint.y} L${lastPoint.x} ${lastPoint.y}`);
  const marker = document.querySelector(".chart-point");
  const halo = document.querySelector(".chart-point-halo");
  marker.setAttribute("cx", String(currentPoint.x));
  marker.setAttribute("cy", String(currentPoint.y));
  halo.setAttribute("cx", String(currentPoint.x));
  halo.setAttribute("cy", String(currentPoint.y));
  chartCallout.setAttribute("x", String(currentPoint.x + 12));
  chartCallout.setAttribute("y", String(currentPoint.y - 17));
}

function updateDashboard() {
  const crop = cropData[cropSelect.value];
  const market = marketAdjustments[marketSelect.value];
  const price = parseRupees(crop.price) + market.delta;
  const change = (Number.parseFloat(crop.change) + market.change).toFixed(1);

  cropIcon.textContent = crop.icon;
  priceValue.textContent = formatRupees(price);
  priceChange.textContent = `${change}%`;
  priceChange.parentElement.classList.toggle("trend-down", Number(change) < 0);
  priceChange.parentElement.classList.toggle("trend-up", Number(change) >= 0);
  arrivalValue.textContent = crop.arrivalLevel;
  arrivalCaption.textContent = `About ${crop.arrivals} planning to sell`;
  recommendationDay.textContent = crop.recommendation;
  recommendationCopy.textContent = crop.copy;
  chartCallout.textContent = `TODAY · ${formatRupees(price)}`;
  chartInsight.textContent = crop.insight;
  updateGrossEstimate();
  setChartLine(crop.values.filter((value, index) => index % 2 === 0));
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => toast.classList.remove("visible"), 2800);
}

function updateChecklist() {
  const items = [...checklist.querySelectorAll('input[type="checkbox"]')];
  const done = items.filter((item) => item.checked).length;
  checkProgressLabel.textContent = `${done} of ${items.length} done`;
  checkProgressBar.style.width = `${(done / items.length) * 100}%`;
}

function setBillingPeriod(period) {
  billingPeriod = period;
  const yearly = period === "yearly";
  billingMonthlyButton.classList.toggle("active", !yearly);
  billingMonthlyButton.setAttribute("aria-pressed", String(!yearly));
  billingYearlyButton.classList.toggle("active", yearly);
  billingYearlyButton.setAttribute("aria-pressed", String(yearly));

  document.querySelectorAll(".plan-price strong").forEach((price) => {
    price.textContent = price.dataset[period];
  });
  document.querySelectorAll(".plan-billing-note").forEach((note) => {
    note.textContent = note.dataset[`${period}Note`];
  });
}

function openPlanSelection(plan) {
  if (!Object.hasOwn(planNames, plan)) return;
  pendingPlan = plan;
  const card = document.querySelector(`[data-plan-card="${plan}"]`);
  const price = card.querySelector(".plan-price strong");
  const billing = card.querySelector(".plan-billing-note").textContent;
  checkoutPlanName.textContent = planNames[plan];
  checkoutPlanPrice.textContent = price.dataset[`${billingPeriod}Total`]
    || `${price.textContent} / month`;
  checkoutBillingNote.textContent = billing;
  document.querySelector("#checkout-status").textContent = "";
  document.querySelector("#confirm-plan").disabled = false;
  checkoutDialog.showModal();
}

function confirmPlanSelection() {
  if (!pendingPlan || !Object.hasOwn(planNames, pendingPlan)) return;

  selectedPlan = pendingPlan;
  document.querySelectorAll("[data-plan-card]").forEach((card) => {
    const isSelected = card.dataset.planCard === selectedPlan;
    card.classList.toggle("selected-plan-card", isSelected);
    const button = card.querySelector("[data-select-plan]");
    if (isSelected) {
      button.textContent = "Selected for this demo";
      button.disabled = true;
      return;
    }
    button.disabled = false;
    const label = button.dataset.selectPlan === "free"
      ? "Get started free"
      : `Choose ${planNames[button.dataset.selectPlan]}`;
    button.innerHTML = `${label} <span aria-hidden="true">→</span>`;
  });
  checkoutDialog.close();
  showToast(`${planNames[selectedPlan]} selected for this demo. No charge.`);
  pendingPlan = null;
}

function toggleWeek() {
  const list = document.querySelector("#window-list");
  const button = document.querySelector("#show-week");
  weekExpanded = !weekExpanded;
  if (weekExpanded) {
    const extras = [
      [4, "Harvest & store", "Check cold-room space", "yellow-dot", "Plan"],
      [5, "Review market rates", "Refresh your selling plan", "red-dot", "Check"],
    ];
    extras.forEach(([offset, title, detail, dotClass, rating]) => {
      const date = new Date();
      date.setDate(date.getDate() + offset + 1);
      const item = document.createElement("article");
      item.className = "window-item extra-window";
      item.innerHTML = `<div class="window-date"><strong>${formatDate(date, { day: "2-digit" })}</strong><span>${formatDate(date, { weekday: "short" }).toUpperCase()}</span></div><div class="window-info"><strong>${title}</strong><span>${detail}</span></div><div class="window-rating"><span class="rating-dot ${dotClass}"></span><strong>${rating}</strong></div>`;
      list.append(item);
    });
    button.innerHTML = 'Show less <span aria-hidden="true">↑</span>';
  } else {
    list.querySelectorAll(".extra-window").forEach((item) => item.remove());
    button.innerHTML = 'View week <span aria-hidden="true">→</span>';
  }
}

cropSelect.addEventListener("change", updateDashboard);
marketSelect.addEventListener("change", updateDashboard);
plannerMarket.addEventListener("change", updateGrossEstimate);
harvestQuantityInput.addEventListener("input", updateGrossEstimate);
document.querySelector("#planner-form").addEventListener("submit", saveHarvestPlan);
checklist.addEventListener("change", updateChecklist);
document.querySelector("#show-week").addEventListener("click", toggleWeek);
billingMonthlyButton.addEventListener("click", () => setBillingPeriod("monthly"));
billingYearlyButton.addEventListener("click", () => setBillingPeriod("yearly"));
document.querySelectorAll("[data-select-plan]").forEach((button) => {
  button.addEventListener("click", () => openPlanSelection(button.dataset.selectPlan));
});
document.querySelector("#confirm-plan").addEventListener("click", confirmPlanSelection);
document.querySelector("#cancel-checkout").addEventListener("click", () => checkoutDialog.close());
checkoutDialog.addEventListener("close", () => {
  pendingPlan = null;
});
document.querySelector("#share-plan").addEventListener("click", () => {
  shareMessage.value = makeShareMessage();
  setShareStatus("");
  shareDialog.showModal();
});
document.querySelector("#copy-share").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(shareMessage.value);
    setShareStatus("Message copied. Share it in your farmer group.");
  } catch (error) {
    if (error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError")) {
      shareMessage.focus();
      shareMessage.select();
      setShareStatus("Clipboard access was blocked. Copy the selected message manually.", "error");
      return;
    }
    throw error;
  }
});
document.querySelector("#native-share").addEventListener("click", async () => {
  if (!navigator.share) {
    setShareStatus("Your browser does not support the share sheet. Copy the message instead.", "error");
    return;
  }
  try {
    await navigator.share({ title: "HarvestWindow harvest plan", text: shareMessage.value });
    setShareStatus("Share sheet opened.");
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      setShareStatus("Sharing canceled.");
      return;
    }
    if (error instanceof DOMException && error.name === "NotAllowedError") {
      setShareStatus("Sharing is unavailable here. Copy the message instead.", "error");
      return;
    }
    throw error;
  }
});
document.querySelector("#use-plan").addEventListener("click", (event) => {
  event.currentTarget.classList.add("plan-selected");
  event.currentTarget.innerHTML = 'Plan selected <span aria-hidden="true">✓</span>';
  showToast(`Your ${cropData[cropSelect.value].name} harvest plan is ready.`);
});
document.querySelector(".notification-button").addEventListener("click", () => {
  showToast("You're all caught up on local harvest updates.");
});
document.querySelector(".more-button").addEventListener("click", () => {
  showToast("Farm account settings are coming soon.");
});

updateDates();
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
harvestDateInput.min = getLocalDateString(tomorrow);
harvestDateInput.value = getLocalDateString(tomorrow);
document.querySelector("#native-share").hidden = typeof navigator.share !== "function";
savedPlans = loadSavedPlans();
renderSavedPlans();
updateDashboard();
updateChecklist();
