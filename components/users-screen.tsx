"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export function UsersScreen() {
  const { data } = useSession();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "CASHIER" });
  const isOwner = data?.user.role === "OWNER";

  async function load() {
    const response = await fetch("/api/users");
    if (!response.ok) return;
    const json = await response.json();
    setUsers(json);
  }

  useEffect(() => {
    void load();
  }, []);

  async function createUser() {
    const response = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    if (!response.ok) {
      alert("Cannot create user");
      return;
    }
    setForm({ name: "", email: "", password: "", role: "CASHIER" });
    await load();
  }

  if (!isOwner) {
    return <div className="card">Only OWNER can manage users.</div>;
  }

  return (
    <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
      <div className="card">
        <h2>Create User</h2>
        <div className="grid">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" />
          <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" />
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="Password"
          />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="OWNER">OWNER</option>
            <option value="MANAGER">MANAGER</option>
            <option value="CASHIER">CASHIER</option>
          </select>
          <button onClick={createUser}>Create User</button>
        </div>
      </div>
      <div className="card">
        <h2>Users</h2>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>{user.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
