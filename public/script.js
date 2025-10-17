// Initialize shoe inventory array
let shoeInventory = [];
let nextId = 1;

// DOM Elements
const addShoeForm = document.getElementById('add-shoe-form');
const inventoryTable = document.getElementById('inventory-table').getElementsByTagName('tbody')[0];
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');

// Add new shoe to inventory
addShoeForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const shoe = {
        id: nextId++,
        modelName: document.getElementById('model-name').value,
        stock: parseInt(document.getElementById('stock').value),
        price: parseFloat(document.getElementById('price').value),
        category: document.getElementById('category').value,
        description: document.getElementById('description').value
    };
    
    shoeInventory.push(shoe);
    updateTable();
    addShoeForm.reset();
});

// Update inventory table
function updateTable(shoes = shoeInventory) {
    inventoryTable.innerHTML = '';
    
    shoes.forEach(shoe => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${shoe.id}</td>
            <td>${shoe.modelName}</td>
            <td>${shoe.stock}</td>
            <td>$${shoe.price.toFixed(2)}</td>
            <td>${shoe.category}</td>
            <td>${shoe.description}</td>
            <td>
                <button class="action-btn edit" onclick="editShoe(${shoe.id})">Edit</button>
                <button class="action-btn delete" onclick="deleteShoe(${shoe.id})">Delete</button>
            </td>
        `;
        inventoryTable.appendChild(row);
    });
}

// Delete shoe from inventory
function deleteShoe(id) {
    if (confirm('Are you sure you want to delete this shoe?')) {
        shoeInventory = shoeInventory.filter(shoe => shoe.id !== id);
        updateTable();
    }
}

// Edit shoe in inventory
function editShoe(id) {
    const shoe = shoeInventory.find(s => s.id === id);
    if (!shoe) return;

    // Fill form with shoe data
    document.getElementById('model-name').value = shoe.modelName;
    document.getElementById('stock').value = shoe.stock;
    document.getElementById('price').value = shoe.price;
    document.getElementById('category').value = shoe.category;
    document.getElementById('description').value = shoe.description;

    // Remove the shoe from inventory
    shoeInventory = shoeInventory.filter(s => s.id !== id);
    
    // Update the table
    updateTable();
    
    // Focus on the form
    document.getElementById('model-name').focus();
}

// Search functionality
searchBtn.addEventListener('click', function() {
    const searchTerm = searchInput.value.toLowerCase();
    const filteredShoes = shoeInventory.filter(shoe => 
        shoe.modelName.toLowerCase().includes(searchTerm) ||
        shoe.category.toLowerCase().includes(searchTerm)
    );
    updateTable(filteredShoes);
});

// Initialize empty table
updateTable();