# HarvestWindow Planner

A responsive, static website prototype for helping smallholder farmers make post-harvest timing decisions. The dashboard brings together indicative market-price trends, neighboring farmers' planned arrivals, nearby storage, a suggested harvest window, and a practical produce-handling checklist.

## Run locally

Open `index.html` in a modern browser, or serve the folder with a static file server:

```sh
python -m http.server 8000
```

Then visit <http://localhost:8000>.

## Prototype notes

Crop and market selectors update the sample recommendation and price display. The harvest planner estimates gross sales from the selected crop, market, and quantity; saved plans are kept in browser storage on this device. The optional sharing dialog prepares a message for copying or the device share sheet, but does not submit it to a farmer network. The handling checklist tracks completion in the current page session. Market rates, arrivals, storage capacity, and weather are illustrative interface data; they are not live feeds or agronomic advice. No account, market, storage, or farmer-network service is connected.

The site uses plain HTML, CSS, and JavaScript. Google Fonts are optional and require an internet connection; system fonts are used as fallbacks.

The membership section compares Free, Smart Farmer, and FPO Pro demo plans with monthly and yearly pricing. Yearly prices show the approximate monthly equivalent and annual billed amount with a 20% saving. The plan-selection dialog is a front-end demo only: it does not collect payment details, charge users, or activate subscriptions.
