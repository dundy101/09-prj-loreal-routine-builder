// Cloudflare Worker and OpenAI integration code removed as requested.
/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");

// Array to keep track of selected products
let selectedProducts = [];
let currentProducts = [];
let allProducts = [];

// Array to keep track of the chat history for follow-up questions
let chatHistory = [];

/*
Send a POST request to your Cloudflare Worker to get an AI-generated routine
selectedProducts: array of product objects
userPrompt: string from the user
*/
async function getRoutineFromAI(selectedProducts, userPrompt) {
  // Build the messages for OpenAI using the full chat history
  // The first message sets the system prompt and instructions
  const messages = [
    {
      role: "system",
      content:
        "You are a friendly beauty expert. Only answer questions about the generated routine, skincare, haircare, makeup, fragrance, or related beauty topics. If asked about something else, politely say you can only help with beauty questions. Reply with clear, easy-to-read answers.",
    },
    // Add the full chat history for context
    ...chatHistory,
  ];

  // Prepare the request body for OpenAI
  const requestBody = {
    model: "gpt-4o", // Use gpt-4o as instructed
    messages: messages,
    max_tokens: 300,
  };

  // Show a loading message in a new, slightly larger chat box for each question
  const chatBox = document.createElement("div");
  chatBox.className = "ai-message chat-bigger";
  chatBox.id = "loading-routine";
  chatBox.textContent = "Thinking...";
  chatWindow.appendChild(chatBox);

  try {
    const response = await fetch(
      "https://lorealworker2.dundyhong23.workers.dev/",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );

    const data = await response.json();
    // Get the AI's reply
    const aiReply =
      data.choices && data.choices[0] && data.choices[0].message.content
        ? data.choices[0].message.content
        : "Sorry, I couldn't generate a routine.";

    // Remove the loading message
    if (chatBox) chatBox.remove();

    // Add the AI's reply to the chat history
    chatHistory.push({ role: "assistant", content: aiReply });

    // Only show a reply if the AI reply has non-whitespace content
    if (aiReply && aiReply.trim().length > 0) {
      // Split the reply into lines
      const lines = aiReply.split(/\n|\r/).filter((s) => s.trim().length > 0);

      // Find the first line that looks like a step (starts with a number or bullet)
      let firstStepIdx = lines.findIndex((line) =>
        /^\s*(\d+\.|-\s)/.test(line)
      );
      let introLines = [];
      let stepLines = [];
      if (firstStepIdx > 0) {
        introLines = lines.slice(0, firstStepIdx);
        stepLines = lines.slice(firstStepIdx);
      } else if (firstStepIdx === 0) {
        stepLines = lines;
      } else {
        introLines = lines;
      }

      // Create a new, slightly larger chat box for this reply
      const replyBox = document.createElement("div");
      replyBox.className = "ai-message chat-bigger";

      // Add intro comments (not numbered)
      if (introLines.length > 0) {
        replyBox.innerHTML += introLines
          .map((line) => `<div>${line}</div>`)
          .join("");
      }

      // Add steps as a numbered list
      if (stepLines.length > 0) {
        replyBox.innerHTML += `<ol>${stepLines
          .map(
            (step) => `<li>${step.replace(/^\d+\.\s*|^-\s*/, "").trim()}</li>`
          )
          .join("")}</ol>`;
      }

      // If there are no steps, just show the reply
      if (introLines.length === 0 && stepLines.length === 0) {
        replyBox.innerHTML = aiReply;
      }

      chatWindow.appendChild(replyBox);
    }
  } catch (error) {
    // Remove the loading message if there's an error
    if (chatBox) chatBox.remove();
    const errorBox = document.createElement("div");
    errorBox.className = "ai-message chat-bigger";
    errorBox.textContent =
      "Sorry, there was a problem generating your routine.";
    chatWindow.appendChild(errorBox);
  }
}
/* Show initial placeholder until user selects a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

/* Load product data from JSON file */
async function loadProducts() {
  const response = await fetch("products.json");
  const data = await response.json();
  return data.products;
}

/* Filter and display products when category changes */
categoryFilter.addEventListener("change", async (e) => {
  // Only load all products once
  if (allProducts.length === 0) {
    allProducts = await loadProducts();
  }
  const selectedCategory = e.target.value;

  // Always filter from allProducts for this category
  currentProducts = allProducts.filter(
    (product) => product.category === selectedCategory
  );

  displayProducts(currentProducts);
});

// Add a search field above the product grid
const searchSection = document.querySelector(".search-section");
const searchInput = document.createElement("input");
searchInput.type = "text";
searchInput.id = "productSearch";
searchInput.placeholder = "Search products by name or keyword...";
searchInput.style =
  "margin: 10px 0; padding: 8px; font-size: 1em; width: 100%; max-width: 400px;";
searchSection.appendChild(searchInput);

// Prevent Enter from submitting a form or reloading the page in the search field
searchInput.addEventListener("keydown", function (e) {
  if (e.key === "Enter") {
    e.preventDefault();
    // Optionally, you can trigger filtering here, but input event already does it
  }
});

// Store the current search term
let currentSearchTerm = "";

// Update displayProducts to filter by search term and category
function displayProducts(products) {
  const allProductsList = document.getElementById("allProductsList");
  if (!allProductsList) return;
  // Always filter from allProducts for the selected category, then remove selected products
  let filtered = allProducts;
  const selectedCategory = categoryFilter.value;
  if (selectedCategory) {
    filtered = allProducts.filter(
      (product) => product.category === selectedCategory
    );
  }
  // Remove selected products
  let unselected = filtered.filter(
    (product) =>
      !selectedProducts.some(
        (p) => p.name === product.name && p.brand === product.brand
      )
  );
  // Update currentProducts to always reflect the current unselected list for the selected category
  currentProducts = filtered;
  // Filter by search term
  if (currentSearchTerm.trim() !== "") {
    const term = currentSearchTerm.trim().toLowerCase();
    unselected = unselected.filter(
      (product) =>
        product.name.toLowerCase().includes(term) ||
        (product.keywords &&
          product.keywords.join(" ").toLowerCase().includes(term)) ||
        (product.description &&
          product.description.toLowerCase().includes(term))
    );
  }
  if (unselected.length === 0) {
    allProductsList.innerHTML = `<div class="placeholder-message">No products to show in this category.</div>`;
    return;
  }
  allProductsList.innerHTML = unselected
    .map(
      (product, idx) => `
    <div class="product-card" data-product-name="${product.name}" data-product-brand="${product.brand}" data-idx="${idx}">
      <img src="${product.image}" alt="${product.name}">
      <div class="product-info">
        <h3>${product.name}</h3>
        <p>${product.brand}</p>
      </div>
      <button class="desc-toggle-btn" aria-label="Show description" tabindex="0">
        <span class="desc-bars"><span></span><span></span><span></span></span>
      </button>
    </div>
  `
    )
    .join("");

  // Add click event listeners to each product card for selection
  const productCards = allProductsList.querySelectorAll(".product-card");
  productCards.forEach((card) => {
    card.addEventListener("click", (e) => {
      // Prevent click if desc button or product-desc is clicked
      if (
        e.target.closest(".desc-toggle-btn") ||
        e.target.closest(".product-desc")
      )
        return;
      const name = card.getAttribute("data-product-name");
      const brand = card.getAttribute("data-product-brand");
      const product = allProducts.find(
        (p) => p.name === name && p.brand === brand
      );
      if (!selectedProducts.some((p) => p.name === name && p.brand === brand)) {
        selectedProducts.push(product);
        updateSelectedProducts();
        // After selection, re-filter and update the all products box
        displayProducts(allProducts);
      }
    });
    // Description toggle
    const btn = card.querySelector(".desc-toggle-btn");
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      let desc = card.querySelector(".product-desc");
      if (desc) {
        desc.remove();
        btn.setAttribute("aria-label", "Show description");
      } else {
        const name = card.getAttribute("data-product-name");
        const brand = card.getAttribute("data-product-brand");
        const product = allProducts.find(
          (p) => p.name === name && p.brand === brand
        );
        desc = document.createElement("div");
        desc.className = "product-desc";
        // Show full description, no truncation
        let descText = product.description || "No description available.";
        // Add a close button (×) to the description
        const closeBtn = document.createElement("button");
        closeBtn.textContent = "×";
        closeBtn.setAttribute("aria-label", "Close description");
        closeBtn.style =
          "position:absolute;top:8px;right:8px;background:#e35d5d;color:#fff;border:none;border-radius:50%;width:24px;height:24px;font-size:18px;line-height:20px;cursor:pointer;z-index:20;";
        closeBtn.addEventListener("click", function (ev) {
          ev.stopPropagation();
          desc.remove();
          btn.setAttribute("aria-label", "Show description");
        });
        desc.appendChild(closeBtn);
        // Add the description text
        const descTextDiv = document.createElement("div");
        descTextDiv.textContent = descText;
        descTextDiv.style = "padding-top:18px;";
        desc.appendChild(descTextDiv);
        // Prevent clicks inside the description from bubbling up to the card
        desc.addEventListener("click", (ev) => ev.stopPropagation());
        card.appendChild(desc);
        btn.setAttribute("aria-label", "Hide description");
      }
    });
  });
}

// Listen for input in the search field
searchInput.addEventListener("input", function (e) {
  currentSearchTerm = e.target.value;
  const selectedCategory = categoryFilter.value;
  // If no category is selected, search across all products
  if (!selectedCategory) {
    if (allProducts.length === 0) {
      loadProducts().then((products) => {
        allProducts = products;
        displayProducts(allProducts);
      });
    } else {
      displayProducts(allProducts);
    }
  } else {
    displayProducts(currentProducts);
  }
});

// Helper: Save selected products to localStorage
function saveSelectedProducts() {
  localStorage.setItem("selectedProducts", JSON.stringify(selectedProducts));
}

// Helper: Load selected products from localStorage
function loadSelectedProducts() {
  const saved = localStorage.getItem("selectedProducts");
  if (saved) {
    try {
      selectedProducts = JSON.parse(saved);
    } catch (e) {
      selectedProducts = [];
    }
  }
}

// Helper: Clear all selected products from localStorage
function clearSelectedProducts() {
  selectedProducts = [];
  localStorage.removeItem("selectedProducts");
  updateSelectedProducts();
  displayProducts(currentProducts);
}

// Call loadSelectedProducts on page load
loadSelectedProducts();

// Show selected products under the selected products area
function updateSelectedProducts() {
  if (selectedProducts.length === 0) {
    selectedProductsList.innerHTML = `<div class="placeholder-message">No products selected yet.</div>`;
    return;
  }
  selectedProductsList.innerHTML = selectedProducts
    .map(
      (product, idx) => `
      <div class="product-card selected" data-product-name="${product.name}" data-product-brand="${product.brand}" style="border: 2px solid #E3A535; box-shadow: 0 0 0 3px #E3A53533; position: relative; background: #FFFBEA; cursor: pointer;">
        <span style="position: absolute; top: 8px; right: 8px; background: #E3A535; color: #fff; border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: bold;">✓</span>
        <img src="${product.image}" alt="${product.name}">
        <div class="product-info">
          <h3>${product.name}</h3>
          <p>${product.brand}</p>
        </div>
        <button class="desc-toggle-btn" aria-label="Show description" tabindex="0">
          <span class="desc-bars"><span></span><span></span><span></span></span>
        </button>
        <button class="remove-product-btn" data-idx="${idx}" style="position: absolute; bottom: 8px; right: 8px; background: #e35d5d; color: #fff; border: none; border-radius: 50%; width: 22px; height: 22px; font-size: 16px; font-weight: bold; cursor: pointer;">×</button>
      </div>
    `
    )
    .join("");
  // After updating selected products, also update the all products box
  displayProducts(allProducts);

  // Add click event listeners to deselect and show description
  const selectedCards = selectedProductsList.querySelectorAll(
    ".product-card.selected"
  );
  selectedCards.forEach((card, idx) => {
    card.addEventListener("click", (e) => {
      if (
        e.target.closest(".desc-toggle-btn") ||
        e.target.closest(".remove-product-btn")
      )
        return;
      const name = card.getAttribute("data-product-name");
      const brand = card.getAttribute("data-product-brand");
      selectedProducts = selectedProducts.filter(
        (p) => !(p.name === name && p.brand === brand)
      );
      saveSelectedProducts();
      updateSelectedProducts();
      displayProducts(currentProducts);
    });
    // Description toggle
    const btn = card.querySelector(".desc-toggle-btn");
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      let desc = card.querySelector(".product-desc");
      if (desc) {
        desc.remove();
        btn.setAttribute("aria-label", "Show description");
      } else {
        const name = card.getAttribute("data-product-name");
        const brand = card.getAttribute("data-product-brand");
        const product = selectedProducts.find(
          (p) => p.name === name && p.brand === brand
        );
        desc = document.createElement("div");
        desc.className = "product-desc";
        // Show full description, no truncation
        let descText = product.description || "No description available.";
        desc.textContent = descText;
        card.appendChild(desc);
        btn.setAttribute("aria-label", "Hide description");
      }
    });
    // Remove product button
    const removeBtn = card.querySelector(".remove-product-btn");
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      selectedProducts.splice(idx, 1);
      saveSelectedProducts();
      updateSelectedProducts();
      displayProducts(currentProducts);
    });
  });

  // Add a clear all button
  if (!document.getElementById("clear-selected-btn")) {
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "×";
    closeBtn.setAttribute("aria-label", "Close description");
    closeBtn.style =
      "position:absolute;top:6px;left:6px;background:#e35d5d;color:#fff;border:none;border-radius:50%;width:18px;height:18px;font-size:13px;line-height:16px;cursor:pointer;z-index:20;padding:0;display:flex;align-items:center;justify-content:center;";
    closeBtn.addEventListener("click", function (ev) {
      ev.stopPropagation();
      desc.remove();
      btn.setAttribute("aria-label", "Show description");
    });
    desc.appendChild(closeBtn);
  }
}

// Routine builder: handle Generate Routine button click
const generateRoutineBtn = document.getElementById("generateRoutine");
generateRoutineBtn.addEventListener("click", function () {
  // Get user input from the chat form
  const userInputElem = document.getElementById("userInput");
  const userInput = userInputElem.value;
  // Add the user's question to the chat history
  chatHistory.push({
    role: "user",
    content: `Selected products: ${selectedProducts
      .map((p) => p.name)
      .join(", ")}. ${userInput}`,
  });
  // Show the user's message in a new chat box
  const userBox = document.createElement("div");
  userBox.textContent = userInput;
  chatWindow.appendChild(userBox);
  // Clear the input field after sending
  userInputElem.value = "";
  // Call the function to get the routine from AI
  getRoutineFromAI(selectedProducts, userInput);
});

// Chatbox follow-up: handle chat form submit for follow-up questions
chatForm.addEventListener("submit", function (e) {
  e.preventDefault();
  const userInputElem = document.getElementById("userInput");
  const userInput = userInputElem.value;
  // Add the user's follow-up question to the chat history
  chatHistory.push({ role: "user", content: userInput });
  // Show the user's message in a new chat box
  const userBox = document.createElement("div");
  userBox.className = "user-message chat-bigger";
  userBox.textContent = userInput;
  chatWindow.appendChild(userBox);
  // Clear the input field after sending
  userInputElem.value = "";
  // Call the function to get the AI's answer (no need to pass selectedProducts again)
  getRoutineFromAI(selectedProducts, userInput);
});

// Helper: Detect if a language is RTL
function isRTLLanguage(lang) {
  const rtlLangs = ["ar", "he", "fa", "ur", "ps", "dv", "yi"];
  return rtlLangs.includes(lang);
}

// Helper: Switch between RTL and LTR layout
function setDirection(isRTL) {
  const dirValue = isRTL ? "rtl" : "ltr";
  document.body.setAttribute("dir", dirValue);
  document.querySelector(".page-wrapper").setAttribute("dir", dirValue);
  document.getElementById("allProductsList").setAttribute("dir", dirValue);
  document.getElementById("selectedProductsList").setAttribute("dir", dirValue);
  document.getElementById("chatWindow").setAttribute("dir", dirValue);
  document.getElementById("chatForm").setAttribute("dir", dirValue);
}

// Detect user's language and set direction automatically
function detectAndSetDirection() {
  // Try to detect Google Translate language
  let lang = document.documentElement.lang || "";
  // If Google Translate is used, it sets a class like 'translated-ltr' or 'translated-rtl' on <html>
  const htmlClass = document.documentElement.className;
  if (htmlClass.includes("translated-rtl")) {
    setDirection(true);
    return;
  } else if (htmlClass.includes("translated-ltr")) {
    setDirection(false);
    return;
  }
  // Fallback to browser language
  if (!lang) {
    lang = (navigator.language || navigator.userLanguage || "en").split("-")[0];
  }
  setDirection(isRTLLanguage(lang));
}

// Run on page load
window.addEventListener("DOMContentLoaded", detectAndSetDirection);
// Also check periodically in case Google Translate changes language after load
setInterval(detectAndSetDirection, 2000);
