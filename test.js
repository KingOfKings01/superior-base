const URL = "http://localhost:3000";

async function runTests() {
  console.log("Starting API tests...\n");
  try {
    const testUser = {
      username: `testuser_${Date.now()}`,
      password: "password123",
    };

    console.log("1. Registering a new user...");
    const regRes = await fetch(`${URL}/user/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testUser),
    });
    
    if (!regRes.ok) throw new Error(`Registration failed: ${await regRes.text()}`);
    const regData = await regRes.json();
    console.log("✅ User registered successfully.\n");
    
    const token = regData.token;

    console.log("2. Testing Login...");
    const loginRes = await fetch(`${URL}/user/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testUser),
    });
    
    if (!loginRes.ok) throw new Error(`Login failed: ${await loginRes.text()}`);
    console.log("✅ User logged in successfully.\n");

    const authHeaders = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    };

    console.log("3. Creating a new record in 'students' collection...");
    const newStudent = {
      name: "John Doe",
      email: "john@example.com",
      age: "25",
      course: "MERN Stack"
    };

    const createRes = await fetch(`${URL}/api/students`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(newStudent),
    });

    if (!createRes.ok) throw new Error(`Create record failed: ${await createRes.text()}`);
    const createdRecord = await createRes.json();
    console.log("✅ Record created successfully:", createdRecord.id, "\n");

    console.log("4. Fetching all records from 'students'...");
    const getAllRes = await fetch(`${URL}/api/students`, {
      headers: authHeaders,
    });
    
    if (!getAllRes.ok) throw new Error(`Get all records failed: ${await getAllRes.text()}`);
    const allRecords = await getAllRes.json();
    console.log(`✅ Fetched ${allRecords.length} records successfully.\n`);

    console.log("5. Fetching the specific record...");
    const getOneRes = await fetch(`${URL}/api/students/${createdRecord.id}`, {
      headers: authHeaders,
    });

    if (!getOneRes.ok) throw new Error(`Get specific record failed: ${await getOneRes.text()}`);
    const fetchedRecord = await getOneRes.json();
    console.log("✅ Record fetched correctly:", fetchedRecord.name, "\n");

    console.log("6. Updating the record...");
    const updateRes = await fetch(`${URL}/api/students/${createdRecord.id}`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({ age: "26", status: "Active" }),
    });

    if (!updateRes.ok) throw new Error(`Update record failed: ${await updateRes.text()}`);
    const updatedRecord = await updateRes.json();
    console.log("✅ Record updated successfully. New age:", updatedRecord.age, "\n");

    console.log("7. Deleting the record...");
    const deleteRes = await fetch(`${URL}/api/students/${createdRecord.id}`, {
      method: "DELETE",
      headers: authHeaders,
    });

    if (!deleteRes.ok) throw new Error(`Delete record failed: ${await deleteRes.text()}`);
    console.log("✅ Record deleted successfully.\n");

    console.log("8. Cleaning up (Deleting test user account)...");
    const deleteUserRes = await fetch(`${URL}/user/delete`, {
      method: "DELETE",
      headers: authHeaders,
    });

    if (!deleteUserRes.ok) throw new Error(`Delete user failed: ${await deleteUserRes.text()}`);
    console.log("✅ Test user account deleted successfully.\n");

    console.log("🎉 All tests passed successfully!");

  } catch (error) {
    console.error("❌ Test failed:", error.message);
    if (error.message.includes("fetch failed")) {
      console.log("\nMake sure the server is running on http://localhost:3000 ! (npm start)");
    }
  }
}

runTests();
