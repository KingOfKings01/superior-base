# Guide: How to Create Database Relations

You built a powerful relational system! Because the Admin Panel natively understands SQLite Foreign Keys, you can model **any** type of database relationship (One-to-One, One-to-Many, Many-to-Many) using just the Admin UI. No code required!

Here is the easy logic for how to create them.

---

## 1. One-to-Many (hasMany)
*A classic example: One **User** can have many **Posts**.*

This is the most common relationship and the easiest to create.

**How to create it:**
1. You already have a `User` table.
2. Go to **Create New Table** and create the `posts` table.
3. Add a column named `author` (or `user`).
4. In the Column Type dropdown, select `Relation -> User`.

**Result**: When you go to the `posts` table in the Admin Panel and add a row, it will give you a dropdown of all Users. One user can be selected for many different posts!

---

## 2. One-to-One (hasOne)
*Example: One **User** has one **Profile**.*

A One-to-One relation is created using the exact same logic as a One-to-Many relation. The only difference is how you conceptually use it—you just don't assign the same User to multiple Profiles!

**How to create it:**
1. Go to **Create New Table** and create a `profiles` table.
2. Add a column named `owner` (or `user`).
3. In the Column Type dropdown, select `Relation -> User`.

**Result**: When creating a Profile, you select the User it belongs to from the dropdown. 

---

## 3. Many-to-Many
*Example: Many **Students** can enroll in many **Courses**.*

As you correctly guessed, Many-to-Many requires a **third table** (often called a "Junction" or "Join" table) to connect the two main tables together.

**How to create it:**
1. Create your two main tables:
   - Create a `students` table.
   - Create a `courses` table.
2. Create the Junction Table:
   - Go to **Create New Table** and name it `student_enrollments`.
   - Add a column named `student` and select **Type**: `Relation -> students`.
   - Add a column named `course` and select **Type**: `Relation -> courses`.

**Result**: When you go to the `student_enrollments` table in the Admin Panel and click "Add Row", you will magically get **two dropdowns**: one to select the Student, and one to select the Course. This allows you to infinitely link students and courses together!

> [!TIP]
> **Django Similarities**
> If you are used to Django (I saw you try to run `manage.py`!), this is exactly how Django handles relations under the hood. Django creates join tables for Many-to-Many relationships automatically, but structurally, it is identical to what you just built!
