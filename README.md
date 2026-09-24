# Superior Base

This is a backend server project built with Node.js and Express using a local SQLite database (via `better-sqlite3`). It is designed to be easy to run locally on your machine with absolutely zero setup needed.

## Prerequisites

- Node.js installed on your computer.

## Getting Started

Follow these steps to get the project running on your local machine:

1. **Install Dependencies**
   Open your terminal in the project folder and run:

   ```bash
   npm install
   ```

2. **Setup Environment Variables**
   Create a `.env` file in the root of the project and add the following required variables:

   ```env
   # Database Configuration
   DATABASE_URL="file://./dev.db"

   # JWT Token Secret for End-User Authentication
   JWT_SECRET="your_super_secret_key_change_this_later"

   # Admin Panel Credentials
   ADMIN_USERNAME="admin"
   ADMIN_PASSWORD="password"
   ```

3. **Start the Development Server**
   To start the server, run:

   ```bash
   npm run dev
   ```

   The server will start (using `nodemon` to automatically restart on file changes). **Note:** The SQLite database tables are automatically initialized the first time you run the server, so you do not need to run any manual migration scripts.

## How to use the Built-in Admin Panel

This project comes with a built-in visual database editor that lets you view, add, edit, and delete data, as well as create entirely new tables with custom schema structures.

1. **Configure your Admin Credentials**
   Open the `.env` file in the root of the project. You will see default credentials provided:
   ```env
   ADMIN_USERNAME="admin"
   ADMIN_PASSWORD="password"
   ```
   You can change these to whatever you want.

2. **Open the Admin Panel**
   While your server is running, go to your web browser and navigate to:
   `http://localhost:3000/admin`
   
3. **Explore your Data and Documentation**
   Log in with your superuser credentials. You can now create new custom tables, edit their schema, manage records, and instantly view auto-generated API documentation for your endpoints (including Fetch and Axios examples) by clicking the **API Docs** button for any table!
