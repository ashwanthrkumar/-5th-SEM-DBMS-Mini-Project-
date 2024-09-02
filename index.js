const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const mysql = require("mysql");
const path = require("path");



//const pdf = require('pdfkit');
const fs = require('fs');


// const pdf = require('jspdf');
// require('jspdf-autotable');

// const PDFDocument = require('pdfkit');
// const fs = require('fs');
const app = express();
const encoder = bodyParser.urlencoded({ extended: true }); // Specify extended option
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: "NpTauysnNfyCeKDkMdOsKaSBHtyzPECkQOITKsVwxZDKRTtMTqcCZZSnjBLfOIxlWiQDYSJMNKyhQALJsCfcOHHGHwpUZFdFDVDj", // Change this to a long random string
    resave: false,
    saveUninitialized: true
}));
app.set("view engine", "ejs");

// Serve static files from the 'assets' directory
app.use("/assets", express.static("assets"));

// Database connection setup
const connection = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "assets"
});

// Connect to the database
connection.connect(function (error) {
    if (error) throw error;
    console.log("Connected to the database successfully!");
    console.log(`Server is running on port 4000. Click the link below to open in browser: \x1b]8;;http://localhost:4000/frontend/index.html\x1b\\http://localhost:4000/\x1b]8;;\x1b\\`);
    logActivity("Connected to the database");
});

// Function to log activity in the recent_activity table
function logActivity(description) {
    connection.query("INSERT INTO recent_activity (description) VALUES (?)", [description], function (error, results, fields) {
        if (error) {
            console.error("Error logging activity:", error);
        }
    });
}

// Route to serve index.html
app.get("/", function (req, res) {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Route to serve lg.html
app.get("/login.html", function (req, res) {
    res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Route to handle login form submission
app.post("/login", encoder, function (req, res) {
    var username = req.body.username;
    var password = req.body.password;

    connection.query("SELECT * FROM loginuser WHERE user_name = ? AND user_pass = ?", [username, password], function (error, results, fields) {
        if (error) throw error;
        if (results.length > 0) {
            req.session.loggedIn = true;
            logActivity("User logged in: " + username);
            res.redirect("/welcome");
        } else {
            res.send("Invalid username or password. Please try again.");
        }
    });
});

// Route to serve sp.html form
app.get("/signup.html", function (req, res) {
    res.sendFile(path.join(__dirname, "public", "signup.html"));
});

// Route to handle sp.html form submission
app.post("/signup", encoder, function (req, res) {
    var username = req.body.username;
    var password = req.body.password;

    // Check if username already exists
    connection.query("SELECT * FROM loginuser WHERE user_name = ?", [username], function (error, results, fields) {
        if (error) throw error;
        if (results.length > 0) {
            res.send("Username already exists. Please choose a different one.");
        } else {
            // Insert new user into the database
            connection.query("INSERT INTO loginuser (user_name, user_pass) VALUES (?, ?)", [username, password], function (error, results, fields) {
                if (error) throw error;
                //res.send("sp.html successful!");
                logActivity("User Signed up: " + username);
                res.redirect("/login.html");
            });
        }
    });
});
// Define the formatDate function
function formatDate(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = ('0' + (d.getMonth() + 1)).slice(-2);
    const day = ('0' + d.getDate()).slice(-2);
    return [year, month, day].join('-');
}

// Route to render the edit_asset.ejs form
app.get('/edit_asset/:id', (req, res) => {
    const assetId = req.params.id;

    // Fetch asset data from the database using the assetId
    const sql = 'SELECT * FROM Equipment WHERE equipment_id = ?';
    connection.query(sql, [assetId], (err, result) => {
        if (err) {
            console.error('Error fetching asset data:', err);
            return res.status(500).send('Internal Server Error');
        }
        const sql = 'SELECT * FROM department';
        connection.query(sql, (err, departments) => {
            if (err) {
                console.error('Error fetching departments data:', err);
                return res.status(500).send('Internal Server Error');
            }
            const sql = 'SELECT * FROM lab';
            connection.query(sql, (err, lab) => {
                if (err) {
                    console.error('Error fetching departments data:', err);
                    return res.status(500).send('Internal Server Error');
                }
                // Render the edit_asset.ejs template with the fetched data and formatDate function
                res.render('edit_asset', { asset: result[0], formatDate: formatDate, departments: departments, lab: lab });
            });
        });
    });
});


// // Route to handle form submission for updating the asset
// app.post('/update_asset/:id', (req, res) => {
//     const assetId = req.params.id;
//     const { name, serialNumber, purchaseDate, cost, specifications, status } = req.body;
//     // Update asset data in the database using the assetId
//     const sql = 'UPDATE Equipment SET name = ?, serial_number = ?, purchase_date = ?, cost = ?, specifications = ?, status = ? WHERE equipment_id = ?';
//     connection.query(sql, [name, serialNumber, purchaseDate, cost, specifications, status, assetId], (err, result) => {
//         if (err) {
//             console.error('Error updating asset:', err);
//             return res.status(500).send('Internal Server Error');
//         }
//         // Redirect to asset management page after successful update
//         res.redirect('/asset_management');
//     });
// });

// Route to handle form submission for updating the asset
app.post('/update_asset/:id', (req, res) => {
    const assetId = req.params.id;
    const { name, serialNumber, purchaseDate, cost, status, lab_id } = req.body;

    // Get the current asset data from the database
    const sqlSelect = 'SELECT * FROM Equipment WHERE equipment_id = ?';
    connection.query(sqlSelect, [assetId], (err, rows) => {
        if (err) {
            console.error('Error fetching current asset data:', err);
            return res.status(500).send('Error updating asset. Please try again.');
        }

        if (rows.length === 0) {
            return res.status(404).send('Asset not found.');
        }

        const currentAsset = rows[0];

        // Prepare the update query
        const sqlUpdate = 'UPDATE Equipment SET name = ?, serial_number = ?, purchase_date = ?, cost = ?, status = ?, lab_id = ? WHERE equipment_id = ?';
        const values = [name, serialNumber, purchaseDate, cost, status, lab_id, assetId];

        // Execute the update query
        connection.query(sqlUpdate, values, (err, result) => {
            if (err) {
                console.error('Error updating asset:', err);
                return res.status(500).send('Error updating asset. Please try again.');
            }

            // Log the recent activity
            const updatedFields = [];
            if (name !== currentAsset.name) {
                updatedFields.push(`Name: ${name}`);
            }
            if (serialNumber !== currentAsset.serial_number) {
                updatedFields.push(`Serial Number: ${serialNumber}`);
            }
            if (purchaseDate !== currentAsset.purchase_date) {
                updatedFields.push(`Purchase Date: ${purchaseDate}`);
            }
            if (cost !== currentAsset.cost) {
                updatedFields.push(`Cost: ${cost}`);
            }

            if (status !== currentAsset.status) {
                updatedFields.push(`Status: ${status}`);
            }
            if (lab_id !== currentAsset.lab_id) {
                updatedFields.push(`lab_id: ${lab_id}`);
            }
            if (updatedFields.length > 0) {
                const activityDescription = `UPDATE activity for Asset with ID ${assetId} `;
                const sqlInsertActivity = 'INSERT INTO recent_activity (description) VALUES (?)';
                connection.query(sqlInsertActivity, [activityDescription], (err, result) => {
                    if (err) {
                        console.error('Error logging activity:', err);
                        return res.status(500).send('Error logging activity. Please try again.');
                    }
                    console.log('Recent activity logged:', activityDescription);
                });
            }

            // Redirect to asset management page after successful update
            res.redirect('/asset_management');
        });
    });
});






// Route to serve the welcome page and fetch recent activities
app.get("/welcome", function (req, res) {
    if (!req.session.loggedIn) {
        //return res.status(403).send("Unauthorized: You must be logged in to access this page.");
        res.redirect("/login.html");
    }
    var username = req.session.username;
    // Fetch recent activities from the database
    connection.query("SELECT * FROM recent_activity ORDER BY timestamp DESC LIMIT 8", function (error, recentActivities, fields) {
        if (error) {
            console.error("Error fetching recent activities:", error);
            return res.status(500).send("Internal Server Error");
        }

        // Fetch project data from the database
        connection.query("SELECT name, progress_percentage FROM Projects LIMIT 8", function (error, projects, fields) {
            if (error) {
                console.error("Error fetching project data:", error);
                return res.status(500).send("Internal Server Error");
            }

            // Fetch approval workflow data from the database


            // Render the welcome page with recent activities data and project data
            res.render("welcome", { recentActivities: recentActivities, username: username, projects: projects, });
        });
    });
});


// Backend route to fetch department data
app.get('/departments', (req, res) => {
    // Fetch department data from the database
    connection.query('SELECT * FROM department', (err, departments) => {
        if (err) {
            console.error('Error fetching departments:', err);
            return res.status(500).send('Internal Server Error');
        }
        // Render the department_management.ejs template with department data
        res.render('department_management', { departments: departments });
    });
});



app.get('/asset_management', (req, res) => {
    // Execute queries to retrieve counts
    connection.query('SELECT COUNT(*) AS total_assets_count FROM equipment', (err, totalAssetsResult) => {
        if (err) {
            console.error('Error retrieving total assets count:', err);
            return res.status(500).send('Internal Server Error');
        }

        connection.query('SELECT COUNT(*) AS active_assets_count FROM equipment WHERE status = ?', ['Active'], (err, activeAssetsResult) => {
            if (err) {
                console.error('Error retrieving active assets count:', err);
                return res.status(500).send('Internal Server Error');
            }


            // Fetch departments data from your database
            const sql = 'SELECT * FROM lab';
            connection.query(sql, (err, lab) => {
                if (err) {
                    console.error('Error fetching departments data:', err);
                    return res.status(500).send('Internal Server Error');
                }
                const sql = 'SELECT * FROM department';
                connection.query(sql, (err, departments) => {
                    if (err) {
                        console.error('Error fetching departments data:', err);
                        return res.status(500).send('Internal Server Error');
                    }
                    // Execute query to retrieve equipment data
                    connection.query('SELECT * FROM Equipment', (err, equipmentResult) => {
                        if (err) {
                            console.error('Error retrieving equipment data:', err);
                            return res.status(500).send('Internal Server Error');
                        }

                        // Render asset management template with counts
                        res.render('asset_management', {
                            totalAssetsCount: totalAssetsResult[0].total_assets_count,
                            activeAssetsCount: activeAssetsResult[0].active_assets_count,
                            departments: departments,
                            lab: lab,
                            equipment: equipmentResult
                        });
                    });
                });
            });
        });
    });
});

// // Route to handle PDF download
// app.post('/downloadPDF', (req, res) => {
//     // Create a new PDF document
//     const doc = new pdf();

//     // Pipe the PDF content to a writable stream
//     const stream = fs.createWriteStream('equipment_table.pdf');

//     // Define PDF content
//     doc.pipe(stream);
//     doc.fontSize(12);
//     doc.text('Equipment Table', { align: 'center' });
//     doc.moveDown();

//     // Add table headers
//     doc.font('Helvetica-Bold');
//     doc.text('Equipment ID    Name    Serial Number    Purchase Date    Cost    Status    Lab ID', { continued: true });
//     doc.moveDown();

//     // Fetch equipment data from the database
//     connection.query('SELECT * FROM Equipment', (err, equipmentResult) => {
//         if (err) {
//             console.error('Error retrieving equipment data:', err);
//             return res.status(500).send('Internal Server Error');
//         }

//         // Add equipment data to the PDF
//         doc.font('Helvetica');
//         equipmentResult.forEach(equipment => {
//             doc.text(`${equipment.equipment_id}    ${equipment.name}    ${equipment.serial_number}    ${equipment.purchase_date}    ${equipment.cost}    ${equipment.status}    ${equipment.lab_id}`);
//             doc.moveDown();
//         });

//         // Finalize the PDF
//         doc.end();

//         // Wait for the PDF to finish writing and then trigger download
//         stream.on('finish', () => {
//             res.download('equipment_table.pdf', 'equipment_table.pdf', (err) => {
//                 if (err) {
//                     console.error('Error downloading PDF:', err);
//                     return res.status(500).send('Internal Server Error');
//                 }
//                 // Delete the PDF file after download is complete
//                 fs.unlinkSync('equipment_table.pdf');
//             });
//         });
//     });
// });

// // Route to handle PDF download
// app.post('/downloadPDF', (req, res) => {
//     // Create a new PDF document
//     const doc = new pdf();

//     // Define table column widths
//     const columnWidths = [80, 120, 120, 100, 60, 80, 60]; // Adjust column widths as needed

//     // Define table header
//     const tableHeader = ['Equipment ID', 'Name', 'Serial Number', 'Purchase Date', 'Cost', 'Status', 'Lab ID'];

//     // Fetch equipment data from the database
//     connection.query('SELECT * FROM Equipment', (err, equipmentResult) => {
//         if (err) {
//             console.error('Error retrieving equipment data:', err);
//             return res.status(500).send('Internal Server Error');
//         }

//         // Define position for the table
//         let yPos = 50;

//         // Add table header
//         tableHeader.forEach((header, index) => {
//             doc.text(header, 50 + (columnWidths[index] / 2), yPos, { align: 'center' });
//         });
//         yPos += 20;

//         // Add table rows
//         equipmentResult.forEach(equipment => {
//             yPos += 20;
//             doc.text(equipment.equipment_id.toString(), 50 + (columnWidths[0] / 2), yPos, { align: 'center' });
//             doc.text(equipment.name, 50 + columnWidths[0] + (columnWidths[1] / 2), yPos, { align: 'center' });
//             doc.text(equipment.serial_number, 50 + columnWidths[0] + columnWidths[1] + (columnWidths[2] / 2), yPos, { align: 'center' });
//             doc.text(equipment.purchase_date.toString(), 50 + columnWidths[0] + columnWidths[1] + columnWidths[2] + (columnWidths[3] / 2), yPos, { align: 'center' });
//             doc.text(equipment.cost.toString(), 50 + columnWidths[0] + columnWidths[1] + columnWidths[2] + columnWidths[3] + (columnWidths[4] / 2), yPos, { align: 'center' });
//             doc.text(equipment.status, 50 + columnWidths[0] + columnWidths[1] + columnWidths[2] + columnWidths[3] + columnWidths[4] + (columnWidths[5] / 2), yPos, { align: 'center' });
//             doc.text(equipment.lab_id.toString(), 50 + columnWidths[0] + columnWidths[1] + columnWidths[2] + columnWidths[3] + columnWidths[4] + columnWidths[5] + (columnWidths[6] / 2), yPos, { align: 'center' });
//         });

//         // Finalize the PDF
//         doc.end();

//         // Wait for the PDF to finish writing and then trigger download
//         const stream = doc.pipe(fs.createWriteStream('equipment_table.pdf'));
//         stream.on('finish', () => {
//             res.download('equipment_table.pdf', 'equipment_table.pdf', (err) => {
//                 if (err) {
//                     console.error('Error downloading PDF:', err);
//                     return res.status(500).send('Internal Server Error');
//                 }
//                 // Delete the PDF file after download is complete
//                 fs.unlinkSync('equipment_table.pdf');
//             });
//         });
//     });
// });
const { jsPDF } = require('jspdf');
require('jspdf-autotable');


// Route to handle PDF download
app.post('/downloadPDF', (req, res) => {
    // Create a new PDF document
    const doc = new jsPDF();

    // Define table headers
    const headers = ['Equipment ID', 'Name', 'Serial Number', 'Purchase Date', 'Cost', 'Status', 'Lab ID'];

    // Fetch equipment data from the database
    connection.query('SELECT * FROM Equipment', (err, equipmentResult) => {
        if (err) {
            console.error('Error retrieving equipment data:', err);
            return res.status(500).send('Internal Server Error');
        }

        // Format equipment data into an array of arrays for the table
        const data = equipmentResult.map(equipment => [
            equipment.equipment_id,
            equipment.name,
            equipment.serial_number,
            equipment.purchase_date,
            equipment.cost,
            equipment.status,
            equipment.lab_id
        ]);

        // Add table to the PDF
        doc.autoTable({
            head: [headers],
            body: data,
            startY: 20 // Adjust as needed
        });

        // Save the PDF to a file
        const fileName = 'equipment_table.pdf';
        doc.save(fileName);

        // Send the file as a response
        res.download(fileName, (err) => {
            if (err) {
                console.error('Error downloading PDF:', err);
                return res.status(500).send('Internal Server Error');
            }
            // Delete the PDF file after download is complete
            fs.unlinkSync(fileName);
        });
    });
});

// Route to handle PDF download for projects table
app.post('/downloadProjectsPDF', (req, res) => {
    // Create a new PDF document
    const doc = new jsPDF();

    // Define table headers
    const headers = ['Project ID', 'Name', 'Funding Source', 'Start Date', 'End Date', 'Budget', 'Status', 'Progress Percentage', 'Department ID'];

    // Fetch projects data from the database
    connection.query('SELECT * FROM projects', (err, projectsResult) => {
        if (err) {
            console.error('Error retrieving projects data:', err);
            return res.status(500).send('Internal Server Error');
        }

        // Format projects data into an array of arrays for the table
        const data = projectsResult.map(project => [
            project.project_id,
            project.name,
            project.funding_source,
            project.start_date,
            project.end_date,
            project.budget,
            project.status,
            project.progress_percentage,
            project.department_id
        ]);

        // Add table to the PDF
        doc.autoTable({
            head: [headers],
            body: data,
            startY: 20 // Adjust as needed
        });

        // Save the PDF to a file
        const fileName = 'projects_table.pdf';
        doc.save(fileName);

        // Send the file as a response
        res.download(fileName, (err) => {
            if (err) {
                console.error('Error downloading PDF:', err);
                return res.status(500).send('Internal Server Error');
            }
            // Delete the PDF file after download is complete
            fs.unlinkSync(fileName);
        });
    });
});


app.post('/addAsset', (req, res) => {
    // Extract form data from request body
    const { name, serialNumber, purchaseDate, cost, status, lab_id } = req.body;

    // Execute SQL INSERT query to add a new asset
    connection.query('INSERT INTO Equipment (name, serial_number, purchase_date, cost, status, lab_id) VALUES (?, ?, ?, ?, ?, ?)',
        [name, serialNumber, purchaseDate, cost, status, lab_id],
        (err, result) => {
            if (err) {
                console.error('Error adding asset:', err);
                return res.status(500).send('Internal Server Error');
            }
            // Get the ID of the newly inserted asset
            const equipmentId = result.insertId;

            // Log activity for the new asset creation with equipment ID
            logActivity("New asset created with ID: " + equipmentId);


        });
});



// Assuming you're using Express
app.post('/deleteRecord', (req, res) => {
    const { equipmentId } = req.body;

    // Execute SQL DELETE query to delete the record with the specified equipmentId
    connection.query('DELETE FROM Equipment WHERE equipment_id = ?', [equipmentId], (err, result) => {
        logActivity("DELETE activity for asset with ID: " + equipmentId);
        if (err) {
            console.error('Error deleting record:', err);
            return res.status(500).send('Internal Server Error');
        }

        console.log('Record deleted successfully');
        // Send a success response
        res.json({ message: 'Record deleted successfully' });
    });
});


// Serve static files from the 'frontend' directory
app.use('/frontend', express.static('frontend'));


// Route to handle logout
app.post("/logout", function (req, res) {
    // Destroy the session
    req.session.destroy(function (err) {
        if (err) {
            console.error("Error destroying session:", err);
            return res.status(500).send("Internal Server Error");
        }
        // Redirect the user to index.html after successful logout
        res.redirect("/frontend/index.html");
        // Log the logout activity
        logActivity("Logged out Successfully");
    });
});

// Route to fetch total assets count
app.get("/getTotalAssets", function (req, res) {
    connection.query("SELECT COUNT(*) AS total_assets FROM Equipment", function (error, results, fields) {
        if (error) {
            console.error("Error fetching total assets:", error);
            res.status(500).send("Internal Server Error");
        } else {
            const totalAssets = results[0].total_assets;
            res.json({ total_assets: totalAssets });
        }
    });
});
// Inside an Express route handler function
app.get('/getActiveProjectsCount', function (req, res) {
    connection.query("SELECT COUNT(*) AS active_projects_count FROM Projects WHERE status = 'Active'", function (error, results, fields) {
        if (error) {
            console.error("Error fetching active projects count:", error);
            res.status(500).send("Internal Server Error");
        } else {
            // Extract the count of active projects from the query results
            const activeProjectsCount = results[0].active_projects_count;

            // Send the count of active projects to the frontend
            res.json({ active_projects_count: activeProjectsCount });
        }
    });
});





//PROJECT MANAGEMENT





app.get('/project_management', (req, res) => {
    // Execute SQL queries
    connection.query('SELECT COUNT(*) AS total_projects FROM Projects', (error, results) => {
        if (error) throw error;
        const totalProjectsCount = results[0].total_projects;

        connection.query('SELECT COUNT(*) AS active_projects FROM Projects WHERE status = "Active"', (error, results) => {
            if (error) throw error;
            const activeProjectsCount = results[0].active_projects;

            connection.query('SELECT COUNT(*) AS college_funded_projects FROM Projects WHERE funding_source = "SJBIT"', (error, results) => {
                if (error) throw error;
                const collegeFundedProjectsCount = results[0].college_funded_projects;

                connection.query('SELECT COUNT(*) AS external_funded_projects FROM Projects WHERE funding_source != "SJBIT"', (error, results) => {
                    if (error) throw error;
                    const externalFundedProjectsCount = results[0].external_funded_projects;
                    // Execute query to retrieve equipment data
                    connection.query('SELECT p.*, d.name AS department_name FROM projects p LEFT JOIN department d ON p.department_id = d.department_id', (err, projectResult) => {
                        if (err) {
                            console.error('Error retrieving equipment data:', err);
                            return res.status(500).send('Internal Server Error');
                        }
                        // Now the projectResult will include the department name as 'department_name'

                        // Fetch departments data from your database
                        const sql = 'SELECT * FROM department';
                        connection.query(sql, (err, departments) => {
                            if (err) {
                                console.error('Error fetching departments data:', err);
                                return res.status(500).send('Internal Server Error');
                            }

                            // Render the index.ejs file with the obtained counts
                            res.render('project_management', {
                                totalProjectsCount: totalProjectsCount,
                                activeProjectsCount: activeProjectsCount,
                                collegeFundedProjectsCount: collegeFundedProjectsCount,
                                externalFundedProjectsCount: externalFundedProjectsCount,
                                projects: projectResult,
                                departments: departments
                            });
                        });
                    });
                });
            });
        });
    });
});

app.post('/addProject', (req, res) => {
    // Extract form data from request body
    const { name, fundingSource, startDate, endDate, budget, status, progressPercentage, department_id } = req.body;

    // Execute SQL INSERT query to add a new project
    connection.query('INSERT INTO Projects (name, funding_source, start_date, end_date, budget, status, progress_percentage, department_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [name, fundingSource, startDate, endDate, budget, status, progressPercentage, department_id],

        (err, result) => {
            if (err) {
                console.error('Error adding project:', err);
                return res.status(500).send('Internal Server Error');
            }
            console.log(result);
            const project_id = result.insertId;
            logActivity("New project created with ID: " + project_id);

        });
});




// Assuming you're using Express
app.post('/deleteRecordP', (req, res) => {
    const { project_id } = req.body;

    // Execute SQL DELETE query to delete the record with the specified project_id
    connection.query('DELETE FROM projects WHERE project_id = ?', [project_id], (err, result) => {
        if (err) {
            console.error('Error deleting record:', err);
            return res.status(500).send('Internal Server Error');
        }
        logActivity("DELETE activity for project with ID: " + project_id);
        console.log('Record deleted successfully');
        // Send a success response
        res.json({ message: 'Record deleted successfully' });
    });
});

//route to handle edit_project.ejs
app.get('/edit_project/:id', (req, res) => {
    const projectId = req.params.id;

    // Fetch project data from the database using the project ID
    const sql = 'SELECT * FROM Projects WHERE project_id = ?';
    connection.query(sql, [projectId], (err, result) => {
        if (err) {
            console.error('Error fetching project data:', err);
            return res.status(500).send('Internal Server Error');
        }

        const sql = 'SELECT * FROM department';
        connection.query(sql, (err, departments) => {
            if (err) {
                console.error('Error fetching departments data:', err);
                return res.status(500).send('Internal Server Error');
            }
            // Render the edit_project.ejs template with the fetched data and formatDate function
            res.render('edit_project', { project: result[0], formatDate: formatDate, departments: departments });
        });
    });
});
//update_project
app.post('/update_project/:id', (req, res) => {
    const projectId = req.params.id;
    const { name, fundingSource, startDate, endDate, budget, progress, status, departmentId } = req.body;

    // Prepare the update query
    const sqlUpdate = 'UPDATE Projects SET name = ?, funding_source = ?, start_date = ?, end_date = ?, budget = ?, progress_percentage = ? , status = ?, department_id = ? WHERE project_id = ?';
    const values = [name, fundingSource, startDate, endDate, budget, progress, status, departmentId, projectId];

    // Execute the update query
    connection.query(sqlUpdate, values, (err, result) => {
        if (err) {
            console.error('Error updating project:', err);
            return res.status(500).send('Error updating project. Please try again.');
        }
        logActivity("UPDATE activity for project with ID: " + projectId);
        // Redirect to project management page after successful update
        res.redirect('/project_management');
    });
});


/*DEPARTMENT MANAGEMENT*/
app.get('/department_management', (req, res) => {
    // Execute queries to retrieve counts
    connection.query('SELECT COUNT(*) AS total_departments, SUM(total_employees) AS total_employees FROM Department', (err, results) => {
        if (err) {
            console.error('Error fetching department statistics:', err);
            return res.status(500).send('Internal Server Error');
        }

        // Extract department and employee counts from the query result
        const totalDepartmentsCount = results[0].total_departments;
        const totalEmployeesCount = results[0].total_employees;
        // Execute query to retrieve equipment data
        connection.query('SELECT * FROM Equipment', (err, equipmentResult) => {
            if (err) {
                console.error('Error retrieving equipment data:', err);
                return res.status(500).send('Internal Server Error');
            }
            const sql = 'SELECT * FROM department';
            connection.query(sql, (err, departments) => {
                if (err) {
                    console.error('Error fetching departments data:', err);
                    return res.status(500).send('Internal Server Error');
                }
                // Render asset management template with counts
                res.render('department_management', {
                    totalDepartmentsCount: totalDepartmentsCount, totalEmployeesCount,
                    equipment: equipmentResult,
                    departments: departments
                });
            });
        });
    });
});
// Endpoint to fetch department data and project count per department
app.get('/departmentProjectCounts', (req, res) => {
    // SQL query to fetch department data and count of projects per department
    const sql = `
        SELECT d.name AS department_name, COUNT(p.project_id) AS project_count
        FROM Department d
        LEFT JOIN Projects p ON d.department_id = p.department_id
        GROUP BY d.department_id;
    `;

    // Execute SQL query
    connection.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching department data and project counts:', err);
            return res.status(500).send('Internal Server Error');
        }
        // Send the results as JSON response
        res.json(results);
    });
});

app.get('/ise', (req, res) => {
    // Execute query to retrieve total employees count for ISE department
    const sql = 'SELECT total_employees FROM Department WHERE name = "Information Science & Engineering"';
    connection.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching total employees count for ISE department:', err);
            return res.status(500).send('Internal Server Error');
        }
        const sql = 'SELECT * FROM department';
        connection.query(sql, (err, departments) => {
            if (err) {
                console.error('Error fetching departments data:', err);
                return res.status(500).send('Internal Server Error');
            }

            // Extract total employees count for ISE department from query result
            const totalISEEmployees = results.length > 0 ? results[0].total_employees : 0;

            // Render ise template with total ISE employees count
            res.render('ise', { totalISEEmployees, departments: departments });
        });
    });
});


app.get('/iseProjectData', (req, res) => {
    // Query to fetch project data for the ISE department from the database
    const sql = `
        SELECT p.name AS project_name, p.progress_percentage AS completion_percentage
        FROM Projects p
        JOIN Department d ON p.department_id = d.department_id
        WHERE d.name = 'Information Science & Engineering'`;

    // Execute the SQL query
    connection.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching ISE project data:', err);
            return res.status(500).send('Internal Server Error');
        }

        // Send the project data as JSON response
        res.json(results);
    });
});



app.get('/aiml', (req, res) => {
    // Execute query to retrieve total employees count for ISE department
    const sql = 'SELECT total_employees FROM Department WHERE name = "Artificial Intelligence & Machine Learning"';
    connection.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching total employees count for ISE department:', err);
            return res.status(500).send('Internal Server Error');
        }
        const sql = 'SELECT * FROM department';
        connection.query(sql, (err, departments) => {
            if (err) {
                console.error('Error fetching departments data:', err);
                return res.status(500).send('Internal Server Error');
            }

            // Extract total employees count for ISE department from query result
            const totalaimlEmployees = results.length > 0 ? results[0].total_employees : 0;

            // Render ise template with total ISE employees count
            res.render('aiml', { totalaimlEmployees, departments: departments });
        });
    });
});


app.get('/aimlProjectData', (req, res) => {
    // Query to fetch project data for the AIML department from the database
    const sql = `
        SELECT p.name AS project_name, p.progress_percentage AS completion_percentage
        FROM Projects p
        JOIN Department d ON p.department_id = d.department_id
        WHERE d.name = 'Artificial Intelligence & Machine Learning'`;

    // Execute the SQL query
    connection.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching AIML project data:', err);
            return res.status(500).send('Internal Server Error');
        }

        // Send the project data as JSON response
        res.json(results);
    });
});

app.get('/ce', (req, res) => {
    // Execute query to retrieve total employees count for ISE department
    const sql = 'SELECT total_employees FROM Department WHERE name = "Civil Engineering"';
    connection.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching total employees count for ISE department:', err);
            return res.status(500).send('Internal Server Error');
        }
        const sql = 'SELECT * FROM department';
        connection.query(sql, (err, departments) => {
            if (err) {
                console.error('Error fetching departments data:', err);
                return res.status(500).send('Internal Server Error');
            }

            // Extract total employees count for ISE department from query result
            const totalCEEmployees = results.length > 0 ? results[0].total_employees : 0;

            // Render ise template with total ISE employees count
            res.render('ce', { totalCEEmployees, departments: departments });
        });
    });
});


app.get('/ceProjectData', (req, res) => {
    // Query to fetch project data for the AIML department from the database
    const sql = `
        SELECT p.name AS project_name, p.progress_percentage AS completion_percentage
        FROM Projects p
        JOIN Department d ON p.department_id = d.department_id
        WHERE d.name = 'Civil Engineering'`;

    // Execute the SQL query
    connection.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching AIML project data:', err);
            return res.status(500).send('Internal Server Error');
        }

        // Send the project data as JSON response
        res.json(results);
    });
});


app.get('/cse', (req, res) => {
    // Execute query to retrieve total employees count for ISE department
    const sql = 'SELECT total_employees FROM Department WHERE name = "Computer Science And Engineering"';
    connection.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching total employees count for CSE department:', err);
            return res.status(500).send('Internal Server Error');
        }
        const sql = 'SELECT * FROM department';
        connection.query(sql, (err, departments) => {
            if (err) {
                console.error('Error fetching departments data:', err);
                return res.status(500).send('Internal Server Error');
            }

            // Extract total employees count for ISE department from query result
            const totalcseEmployees = results.length > 0 ? results[0].total_employees : 0;

            // Render ise template with total ISE employees count
            res.render('cse', { totalcseEmployees, departments: departments });
        });
    });
});


app.get('/cseProjectData', (req, res) => {
    // Query to fetch project data for the AIML department from the database
    const sql = `
        SELECT p.name AS project_name, p.progress_percentage AS completion_percentage
        FROM Projects p
        JOIN Department d ON p.department_id = d.department_id
        WHERE d.name = 'Computer Science And Engineering'`;

    // Execute the SQL query
    connection.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching AIML project data:', err);
            return res.status(500).send('Internal Server Error');
        }

        // Send the project data as JSON response
        res.json(results);
    });
});


app.get('/ds', (req, res) => {
    // Execute query to retrieve total employees count for ISE department
    const sql = 'SELECT total_employees FROM Department WHERE name = "Computer Science And Engineering(Data Science)"';
    connection.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching total employees count for DS department:', err);
            return res.status(500).send('Internal Server Error');
        }
        const sql = 'SELECT * FROM department';
        connection.query(sql, (err, departments) => {
            if (err) {
                console.error('Error fetching departments data:', err);
                return res.status(500).send('Internal Server Error');
            }

            // Extract total employees count for ISE department from query result
            const totaldsEmployees = results.length > 0 ? results[0].total_employees : 0;

            // Render ise template with total ISE employees count
            res.render('ds', { totaldsEmployees, departments: departments });
        });
    });
});


app.get('/dsProjectData', (req, res) => {
    // Query to fetch project data for the AIML department from the database
    const sql = `
        SELECT p.name AS project_name, p.progress_percentage AS completion_percentage
        FROM Projects p
        JOIN Department d ON p.department_id = d.department_id
        WHERE d.name = 'Computer Science And Engineering(Data Science)'`;

    // Execute the SQL query
    connection.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching DS project data:', err);
            return res.status(500).send('Internal Server Error');
        }

        // Send the project data as JSON response
        res.json(results);
    });
});


app.get('/eee', (req, res) => {
    // Execute query to retrieve total employees count for ISE department
    const sql = 'SELECT total_employees FROM Department WHERE name = "Electrical And Electronics Engineering"';
    connection.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching total employees count for EEE department:', err);
            return res.status(500).send('Internal Server Error');
        }
        const sql = 'SELECT * FROM department';
        connection.query(sql, (err, departments) => {
            if (err) {
                console.error('Error fetching departments data:', err);
                return res.status(500).send('Internal Server Error');
            }

            // Extract total employees count for ISE department from query result
            const totaleeeEmployees = results.length > 0 ? results[0].total_employees : 0;

            // Render ise template with total ISE employees count
            res.render('eee', { totaleeeEmployees, departments: departments });
        });
    });
});


app.get('/eeeProjectData', (req, res) => {
    // Query to fetch project data for the AIML department from the database
    const sql = `
        SELECT p.name AS project_name, p.progress_percentage AS completion_percentage
        FROM Projects p
        JOIN Department d ON p.department_id = d.department_id
        WHERE d.name = 'Electrical And Electronics Engineering'`;

    // Execute the SQL query
    connection.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching DS project data:', err);
            return res.status(500).send('Internal Server Error');
        }

        // Send the project data as JSON response
        res.json(results);
    });
});

app.get('/ec', (req, res) => {
    // Execute query to retrieve total employees count for ISE department
    const sql = 'SELECT total_employees FROM Department WHERE name = "Electronics And Communication Engineering"';
    connection.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching total employees count for EC department:', err);
            return res.status(500).send('Internal Server Error');
        }
        const sql = 'SELECT * FROM department';
        connection.query(sql, (err, departments) => {
            if (err) {
                console.error('Error fetching departments data:', err);
                return res.status(500).send('Internal Server Error');
            }

            // Extract total employees count for ISE department from query result
            const totalecEmployees = results.length > 0 ? results[0].total_employees : 0;

            // Render ise template with total ISE employees count
            res.render('ec', { totalecEmployees, departments: departments });
        });
    });
});


app.get('/ecProjectData', (req, res) => {
    // Query to fetch project data for the AIML department from the database
    const sql = `
        SELECT p.name AS project_name, p.progress_percentage AS completion_percentage
        FROM Projects p
        JOIN Department d ON p.department_id = d.department_id
        WHERE d.name = 'Electronics And Communication Engineering'`;

    // Execute the SQL query
    connection.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching EC project data:', err);
            return res.status(500).send('Internal Server Error');
        }

        // Send the project data as JSON response
        res.json(results);
    });
});



app.get('/me', (req, res) => {
    // Execute query to retrieve total employees count for ISE department
    const sql = 'SELECT total_employees FROM Department WHERE name = "Mechanical Engineering"';
    connection.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching total employees count for EC department:', err);
            return res.status(500).send('Internal Server Error');
        }
        const sql = 'SELECT * FROM department';
        connection.query(sql, (err, departments) => {
            if (err) {
                console.error('Error fetching departments data:', err);
                return res.status(500).send('Internal Server Error');
            }

            // Extract total employees count for ISE department from query result
            const totalMEEmployees = results.length > 0 ? results[0].total_employees : 0;

            // Render ise template with total ISE employees count
            res.render('me', { totalMEEmployees, departments: departments });
        });
    });
});


app.get('/meProjectData', (req, res) => {
    // Query to fetch project data for the AIML department from the database
    const sql = `
        SELECT p.name AS project_name, p.progress_percentage AS completion_percentage
        FROM Projects p
        JOIN Department d ON p.department_id = d.department_id
        WHERE d.name = 'Mechanical Engineering'`;

    // Execute the SQL query
    connection.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching EC project data:', err);
            return res.status(500).send('Internal Server Error');
        }

        // Send the project data as JSON response
        res.json(results);
    });
});


app.get('/lab_management', (req, res) => {
    // Execute queries to retrieve counts
    connection.query('SELECT COUNT(*) AS total_departments, SUM(total_employees) AS total_employees FROM Department', (err, results) => {
        if (err) {
            console.error('Error fetching department statistics:', err);
            return res.status(500).send('Internal Server Error');
        }

        // Extract department and employee counts from the query result
        const totalDepartmentsCount = results[0].total_departments;
        const totalEmployeesCount = results[0].total_employees;
        // Execute query to retrieve equipment data
        connection.query('SELECT * FROM Equipment', (err, equipmentResult) => {
            if (err) {
                console.error('Error retrieving equipment data:', err);
                return res.status(500).send('Internal Server Error');
            }
            // Execute query to retrieve equipment count
            connection.query('SELECT COUNT(*) AS total_equipment FROM Equipment', (err, equipmentCountResult) => {
                if (err) {
                    console.error('Error retrieving equipment count:', err);
                    return res.status(500).send('Internal Server Error');
                }

                const totalEquipmentCount = equipmentCountResult[0].total_equipment;
                const sql = 'SELECT * FROM department';
                connection.query(sql, (err, departments) => {
                    if (err) {
                        console.error('Error fetching departments data:', err);
                        return res.status(500).send('Internal Server Error');
                    }
                    // Render asset management template with counts
                    res.render('lab_management', {
                        totalDepartmentsCount, totalEmployeesCount, totalEquipmentCount,
                        equipment: equipmentResult,
                        departments: departments
                    });
                });
            });
        });
    });
});

app.get('/departmentEquipmentCounts', (req, res) => {
    // Execute SQL query to retrieve equipment counts per department
    const sql = `
        SELECT d.name AS department_name, COUNT(e.equipment_id) AS equipment_count
        FROM Department d
        LEFT JOIN Lab l ON d.department_id = l.department_id
        LEFT JOIN Equipment e ON l.lab_id = e.lab_id
        GROUP BY d.name;
    `;

    connection.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching department equipment counts:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }

        // Send the results as JSON response
        res.json(results);
    });
});


app.get('/ise_lab', (req, res) => {
    // Execute query to retrieve total employees count for ISE department
    const sql = 'SELECT total_employees FROM Department WHERE name = "Information Science & Engineering"';
    connection.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching total employees count for ISE department:', err);
            return res.status(500).send('Internal Server Error');
        }
        const sql = 'SELECT * FROM department';
        connection.query(sql, (err, departments) => {
            if (err) {
                console.error('Error fetching departments data:', err);
                return res.status(500).send('Internal Server Error');
            }

            // Extract total employees count for ISE department from query result
            const totalISEEmployees = results.length > 0 ? results[0].total_employees : 0;

            // Render ise template with total ISE employees count
            res.render('ise_lab', { totalISEEmployees, departments: departments });
        });
    });
});

app.get('/iseLabEquipmentCounts', (req, res) => {
    // Query to retrieve the number of equipments in each lab under ISE
    const sql = `
    SELECT Lab.name, COUNT(Equipment.equipment_id) AS equipment_count
    FROM Lab
    LEFT JOIN Equipment ON Lab.lab_id = Equipment.lab_id
    LEFT JOIN Department ON Lab.department_id = Department.department_id
    WHERE Department.name = 'Information Science & Engineering'
    GROUP BY Lab.lab_id, Lab.name;
    `;

    // Execute the query
    connection.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching lab equipment counts:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }

        // Send the results as JSON response
        res.json(results);
    });
});



app.get('/aiml_lab', (req, res) => {
    // Execute query to retrieve total employees count for ISE department
    const sql = 'SELECT total_employees FROM Department WHERE name = "Artificial Intelligence & Machine Learning"';
    connection.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching total employees count for AIML department:', err);
            return res.status(500).send('Internal Server Error');
        }
        const sql = 'SELECT * FROM department';
        connection.query(sql, (err, departments) => {
            if (err) {
                console.error('Error fetching departments data:', err);
                return res.status(500).send('Internal Server Error');
            }

            // Extract total employees count for ISE department from query result
            const totalISEEmployees = results.length > 0 ? results[0].total_employees : 0;

            // Render ise template with total ISE employees count
            res.render('aiml_lab', { totalISEEmployees, departments: departments });
        });
    });
});

app.get('/aimlLabEquipmentCounts', (req, res) => {
    // Query to retrieve the number of equipments in each lab under ISE
    const sql = `
    SELECT Lab.name, COUNT(Equipment.equipment_id) AS equipment_count
    FROM Lab
    LEFT JOIN Equipment ON Lab.lab_id = Equipment.lab_id
    LEFT JOIN Department ON Lab.department_id = Department.department_id
    WHERE Department.name = 'Artificial Intelligence & Machine Learning'
    GROUP BY Lab.lab_id, Lab.name;
    `;

    // Execute the query
    connection.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching lab equipment counts:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }

        // Send the results as JSON response
        res.json(results);
    });
});


app.get('/ce_lab', (req, res) => {
    // Execute query to retrieve total employees count for ISE department
    const sql = 'SELECT total_employees FROM Department WHERE name = "Civil Engineering"';
    connection.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching total employees count for CE department:', err);
            return res.status(500).send('Internal Server Error');
        }
        const sql = 'SELECT * FROM department';
        connection.query(sql, (err, departments) => {
            if (err) {
                console.error('Error fetching departments data:', err);
                return res.status(500).send('Internal Server Error');
            }

            // Extract total employees count for ISE department from query result
            const totalISEEmployees = results.length > 0 ? results[0].total_employees : 0;

            // Render ise template with total ISE employees count
            res.render('ce_lab', { totalISEEmployees, departments: departments });
        });
    });
});

app.get('/ceLabEquipmentCounts', (req, res) => {
    // Query to retrieve the number of equipments in each lab under ISE
    const sql = `
    SELECT Lab.name, COUNT(Equipment.equipment_id) AS equipment_count
    FROM Lab
    LEFT JOIN Equipment ON Lab.lab_id = Equipment.lab_id
    LEFT JOIN Department ON Lab.department_id = Department.department_id
    WHERE Department.name = 'Civil Engineering'
    GROUP BY Lab.lab_id, Lab.name;
    `;

    // Execute the query
    connection.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching lab equipment counts:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }

        // Send the results as JSON response
        res.json(results);
    });
});


app.get('/cse_lab', (req, res) => {
    // Execute query to retrieve total employees count for ISE department
    const sql = 'SELECT total_employees FROM Department WHERE name = "Computer Science And Engineering"';
    connection.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching total employees count for CSE department:', err);
            return res.status(500).send('Internal Server Error');
        }
        const sql = 'SELECT * FROM department';
        connection.query(sql, (err, departments) => {
            if (err) {
                console.error('Error fetching departments data:', err);
                return res.status(500).send('Internal Server Error');
            }

            // Extract total employees count for ISE department from query result
            const totalISEEmployees = results.length > 0 ? results[0].total_employees : 0;

            // Render ise template with total ISE employees count
            res.render('cse_lab', { totalISEEmployees, departments: departments });
        });
    });
});

app.get('/cseLabEquipmentCounts', (req, res) => {
    // Query to retrieve the number of equipments in each lab under ISE
    const sql = `
    SELECT Lab.name, COUNT(Equipment.equipment_id) AS equipment_count
    FROM Lab
    LEFT JOIN Equipment ON Lab.lab_id = Equipment.lab_id
    LEFT JOIN Department ON Lab.department_id = Department.department_id
    WHERE Department.name = 'Computer Science And Engineering'
    GROUP BY Lab.lab_id, Lab.name;
    `;

    // Execute the query
    connection.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching lab equipment counts:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }

        // Send the results as JSON response
        res.json(results);
    });
});


app.get('/ds_lab', (req, res) => {
    // Execute query to retrieve total employees count for ISE department
    const sql = 'SELECT total_employees FROM Department WHERE name = "Computer Science And Engineering(Data Science)"';
    connection.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching total employees count for CE department:', err);
            return res.status(500).send('Internal Server Error');
        }
        const sql = 'SELECT * FROM department';
        connection.query(sql, (err, departments) => {
            if (err) {
                console.error('Error fetching departments data:', err);
                return res.status(500).send('Internal Server Error');
            }

            // Extract total employees count for ISE department from query result
            const totalISEEmployees = results.length > 0 ? results[0].total_employees : 0;

            // Render ise template with total ISE employees count
            res.render('ds_lab', { totalISEEmployees, departments: departments });
        });
    });
});

app.get('/dsLabEquipmentCounts', (req, res) => {
    // Query to retrieve the number of equipments in each lab under ISE
    const sql = `
    SELECT Lab.name, COUNT(Equipment.equipment_id) AS equipment_count
    FROM Lab
    LEFT JOIN Equipment ON Lab.lab_id = Equipment.lab_id
    LEFT JOIN Department ON Lab.department_id = Department.department_id
    WHERE Department.name = 'Computer Science And Engineering(Data Science)'
    GROUP BY Lab.lab_id, Lab.name;
    `;

    // Execute the query
    connection.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching lab equipment counts:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }

        // Send the results as JSON response
        res.json(results);
    });
});

app.get('/eee_lab', (req, res) => {
    // Execute query to retrieve total employees count for ISE department
    const sql = 'SELECT total_employees FROM Department WHERE name = "Electrical And Electronics Engineering"';
    connection.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching total employees count for EEE department:', err);
            return res.status(500).send('Internal Server Error');
        }
        const sql = 'SELECT * FROM department';
        connection.query(sql, (err, departments) => {
            if (err) {
                console.error('Error fetching departments data:', err);
                return res.status(500).send('Internal Server Error');
            }

            // Extract total employees count for ISE department from query result
            const totalISEEmployees = results.length > 0 ? results[0].total_employees : 0;

            // Render ise template with total ISE employees count
            res.render('eee_lab', { totalISEEmployees, departments: departments });
        });
    });
});

app.get('/eeeLabEquipmentCounts', (req, res) => {
    // Query to retrieve the number of equipments in each lab under ISE
    const sql = `
    SELECT Lab.name, COUNT(Equipment.equipment_id) AS equipment_count
    FROM Lab
    LEFT JOIN Equipment ON Lab.lab_id = Equipment.lab_id
    LEFT JOIN Department ON Lab.department_id = Department.department_id
    WHERE Department.name = 'Electrical And Electronics Engineering'
    GROUP BY Lab.lab_id, Lab.name;
    `;

    // Execute the query
    connection.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching lab equipment counts:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }

        // Send the results as JSON response
        res.json(results);
    });
});

app.get('/ec_lab', (req, res) => {
    // Execute query to retrieve total employees count for ISE department
    const sql = 'SELECT total_employees FROM Department WHERE name = "Electronics And Communication Engineering"';
    connection.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching total employees count for ECE department:', err);
            return res.status(500).send('Internal Server Error');
        }
        const sql = 'SELECT * FROM department';
        connection.query(sql, (err, departments) => {
            if (err) {
                console.error('Error fetching departments data:', err);
                return res.status(500).send('Internal Server Error');
            }

            // Extract total employees count for ISE department from query result
            const totalISEEmployees = results.length > 0 ? results[0].total_employees : 0;

            // Render ise template with total ISE employees count
            res.render('ec_lab', { totalISEEmployees, departments: departments });
        });
    });
});

app.get('/eceLabEquipmentCounts', (req, res) => {
    // Query to retrieve the number of equipments in each lab under ISE
    const sql = `
    SELECT Lab.name, COUNT(Equipment.equipment_id) AS equipment_count
    FROM Lab
    LEFT JOIN Equipment ON Lab.lab_id = Equipment.lab_id
    LEFT JOIN Department ON Lab.department_id = Department.department_id
    WHERE Department.name = 'Electronics And Communication Engineering'
    GROUP BY Lab.lab_id, Lab.name;
    `;

    // Execute the query
    connection.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching lab equipment counts:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }

        // Send the results as JSON response
        res.json(results);
    });
});

app.get('/me_lab', (req, res) => {
    // Execute query to retrieve total employees count for ISE department
    const sql = 'SELECT total_employees FROM Department WHERE name = "Mechanical Engineering"';
    connection.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching total employees count for ME department:', err);
            return res.status(500).send('Internal Server Error');
        }
        const sql = 'SELECT * FROM department';
        connection.query(sql, (err, departments) => {
            if (err) {
                console.error('Error fetching departments data:', err);
                return res.status(500).send('Internal Server Error');
            }

            // Extract total employees count for ISE department from query result
            const totalISEEmployees = results.length > 0 ? results[0].total_employees : 0;

            // Render ise template with total ISE employees count
            res.render('me_lab', { totalISEEmployees, departments: departments });
        });
    });
});

app.get('/meLabEquipmentCounts', (req, res) => {
    // Query to retrieve the number of equipments in each lab under ISE
    const sql = `
    SELECT Lab.name, COUNT(Equipment.equipment_id) AS equipment_count
    FROM Lab
    LEFT JOIN Equipment ON Lab.lab_id = Equipment.lab_id
    LEFT JOIN Department ON Lab.department_id = Department.department_id
    WHERE Department.name = 'Mechanical Engineering'
    GROUP BY Lab.lab_id, Lab.name;
    `;

    // Execute the query
    connection.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching lab equipment counts:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }

        // Send the results as JSON response
        res.json(results);
    });
});



// // Route to handle button click and generate PDF
// app.get('/generatePDF', (req, res) => {
//     // Query data from the SQL table
//     const query = 'SELECT * FROM equipment';
//     connection.query(query, (err, results) => {
//         if (err) {
//             console.error('Error querying database:', err);
//             res.status(500).send('Internal Server Error');
//             return;
//         }

//         // Format the queried data into an array of objects
//         const formattedData = results.map(row => {
//             return {
//                 'Equipment ID': row.equipment_id,
//                 'Name': row.name,
//                 'Serial Number': row.serial_number,
//                 'Purchase Date': row.purchase_date,
//                 'Cost': row.cost,
//                 'Status': row.status,
//                 'Lab ID': row.lab_id
//             };
//         });

//         // Generate PDF

//         pdfDoc.pipe(fs.createWriteStream('equipment_data.pdf'));

//         // Add table headers
//         const headers = Object.keys(formattedData[0]);
//         headers.forEach(header => {
//             pdfDoc.cell(200, 10, header, { underline: true });
//         });
//         pdfDoc.moveDown();

//         // Add table data
//         formattedData.forEach(row => {
//             Object.values(row).forEach(value => {
//                 pdfDoc.cell(200, 10, value, { align: 'left' });
//             });
//             pdfDoc.moveDown();
//         });

//         // Finalize PDF
//         pdfDoc.end();
//         console.log('PDF generated successfully');

//         // Send response
//         res.status(200).send('PDF generated successfully');
//     });
// });





var orm = require('orm');

var router = express.Router();





// Set up the server to listen on port 4000
app.listen(4000, function () {
    console.log("Server is running on port 4000");
});
