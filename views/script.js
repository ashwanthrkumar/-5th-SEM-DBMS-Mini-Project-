// script.js

// Function to format date to YYYY-MM-DD
function formatDate(date) {
    var d = new Date(date),
        year = d.getFullYear(),
        month = ('0' + (d.getMonth() + 1)).slice(-2),
        day = ('0' + d.getDate()).slice(-2);
    return [year, month, day].join('-');
}
