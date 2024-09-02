// Get the equipment ID from the URL parameter
const urlParams = new URLSearchParams(window.location.search);
const equipmentId = urlParams.get('id');

// Fetch the equipment data using the equipment ID
fetch(`/getEquipment?id=${equipmentId}`)
    .then(response => response.json())
    .then(data => {
        // Prefill the form with the fetched data
        document.getElementById('name').value = data.name;
        document.getElementById('serialNumber').value = data.serialNumber;
        document.getElementById('cost').value = data.cost;
        document.getElementById('purchaseDate').value = data.purchaseDate;
        document.getElementById('status').value = data.status;
        document.getElementById('specifications').value = data.specifications;
    })
    .catch(error => {
        console.error('Error fetching equipment data:', error);
    });

// Submit edited data when the form is submitted
document.getElementById('editAssetForm').addEventListener('submit', function (event) {
    event.preventDefault(); // Prevent default form submission

    // Get the edited data from the form
    const formData = new FormData(this);

    // Add equipment ID to the form data
    formData.append('id', equipmentId);

    // Send the edited data to the server to update the equipment record
    fetch('/updateEquipment', {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            alert(data.message); // Show success message
            // Redirect to the asset management page or perform any other action as needed
        })
        .catch(error => {
            console.error('Error updating equipment data:', error);
        });
});
