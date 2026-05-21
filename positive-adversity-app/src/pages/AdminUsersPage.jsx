import { useEffect, useMemo, useState } from "react";
import {
  deleteAllowedUser,
  fetchAllowedUsers,
  PROTECTED_ADMIN_EMAIL,
  updateAllowedUser,
  upsertAllowedUser,
} from "../lib/firestore";

const initialNewUserForm = {
  email: "",
  active: true,
  admin: false,
};

const initialEditForm = {
  email: "",
  active: true,
  admin: false,
};

export default function AdminUsersPage() {
  const [allowedUsers, setAllowedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingEmail, setEditingEmail] = useState("");
  const [editForm, setEditForm] = useState(initialEditForm);
  const [newUserForm, setNewUserForm] = useState(initialNewUserForm);
  const [savingEmail, setSavingEmail] = useState("");
  const [deletingEmail, setDeletingEmail] = useState("");
  const [addingUser, setAddingUser] = useState(false);

  async function loadAllowedUsers() {
    try {
      setLoading(true);
      setError("");
      const users = await fetchAllowedUsers();
      setAllowedUsers(users || []);
    } catch (loadError) {
      console.error("Failed to load allowed users:", loadError);
      setError(loadError?.message || "Failed to load allowed users.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAllowedUsers();
  }, []);

  const activeCount = useMemo(
    () => allowedUsers.filter((user) => user.active).length,
    [allowedUsers],
  );

  const ownerAdminCount = useMemo(
    () =>
      allowedUsers.filter(
        (user) => user.active && user.admin && !user.protectedAdmin,
      ).length,
    [allowedUsers],
  );

  function wouldRemoveLastOwnerAdmin(email, nextUser) {
    const currentUser = allowedUsers.find((user) => user.email === email);
    if (!currentUser?.active || !currentUser?.admin || currentUser.protectedAdmin) {
      return false;
    }

    const nextIsOwnerAdmin =
      nextUser?.active && nextUser?.admin && !nextUser?.protectedAdmin;

    return ownerAdminCount <= 1 && !nextIsOwnerAdmin;
  }

  function handleStartEdit(user) {
    setMessage("");
    setError("");
    setEditingEmail(user.email);
    setEditForm({
      email: user.email,
      active: user.active,
      admin: user.admin,
    });
  }

  function handleCancelEdit() {
    setEditingEmail("");
    setEditForm(initialEditForm);
  }

  async function handleSaveUser(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    setSavingEmail(editingEmail);

    try {
      if (editingEmail === PROTECTED_ADMIN_EMAIL) {
        throw new Error("The protected developer admin cannot be changed.");
      }

      if (
        wouldRemoveLastOwnerAdmin(editingEmail, {
          active: editForm.active,
          admin: editForm.admin,
          protectedAdmin: false,
        })
      ) {
        throw new Error("You must keep at least one active owner admin.");
      }

      await updateAllowedUser(editingEmail, editForm);
      await loadAllowedUsers();
      handleCancelEdit();
      setMessage("Allowed user updated.");
    } catch (saveError) {
      console.error("Failed to update allowed user:", saveError);
      setError(saveError?.message || "Failed to update allowed user.");
    } finally {
      setSavingEmail("");
    }
  }

  async function handleAddUser(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    setAddingUser(true);

    try {
      await upsertAllowedUser(
        newUserForm.email,
        newUserForm.active,
        newUserForm.admin,
      );
      await loadAllowedUsers();
      setNewUserForm(initialNewUserForm);
      setMessage("Allowed user added.");
    } catch (addError) {
      console.error("Failed to add allowed user:", addError);
      setError(addError?.message || "Failed to add allowed user.");
    } finally {
      setAddingUser(false);
    }
  }

  async function handleDeleteUser(email) {
    const confirmed = window.confirm(`Remove ${email} from allowed users?`);
    if (!confirmed) return;

    setMessage("");
    setError("");
    setDeletingEmail(email);

    try {
      if (email === PROTECTED_ADMIN_EMAIL) {
        throw new Error("The protected developer admin cannot be deleted.");
      }

      if (wouldRemoveLastOwnerAdmin(email, null)) {
        throw new Error("You must keep at least one active owner admin.");
      }

      await deleteAllowedUser(email);
      setAllowedUsers((currentUsers) =>
        currentUsers.filter((user) => user.email !== email),
      );
      if (editingEmail === email) {
        handleCancelEdit();
      }
      setMessage("Allowed user deleted.");
    } catch (deleteError) {
      console.error("Failed to delete allowed user:", deleteError);
      setError(deleteError?.message || "Failed to delete allowed user.");
    } finally {
      setDeletingEmail("");
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-slate-900 p-6 text-white shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-300">
          Allowed Users
        </p>
        <h1 className="mt-2 text-3xl font-bold">Admin Users</h1>
        <p className="mt-2 text-sm text-slate-300">
          Manage who is allowed to use the app.
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-500">Allowed Users</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {allowedUsers.length}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-500">Active</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {activeCount}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-500">Owner Admins</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {ownerAdminCount}
          </p>
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {message ? (
        <p className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {message}
        </p>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">Add Allowed User</h2>

        <form className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto_auto]" onSubmit={handleAddUser}>
          <label className="text-sm font-semibold text-slate-700">
            Email
            <input
              type="email"
              value={newUserForm.email}
              onChange={(event) =>
                setNewUserForm((currentForm) => ({
                  ...currentForm,
                  email: event.target.value,
                }))
              }
              required
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal"
            />
          </label>

          <label className="flex items-center gap-2 pt-7 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={newUserForm.active}
              onChange={(event) =>
                setNewUserForm((currentForm) => ({
                  ...currentForm,
                  active: event.target.checked,
                }))
              }
              className="h-4 w-4 rounded border-slate-300"
            />
            Active
          </label>

          <label className="flex items-center gap-2 pt-7 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={newUserForm.admin}
              onChange={(event) =>
                setNewUserForm((currentForm) => ({
                  ...currentForm,
                  admin: event.target.checked,
                }))
              }
              className="h-4 w-4 rounded border-slate-300"
            />
            Admin
          </label>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={addingUser}
              className="w-full rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
            >
              {addingUser ? "Adding..." : "Add User"}
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        {loading ? (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
            Loading allowed users...
          </p>
        ) : allowedUsers.length === 0 ? (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
            No allowed users found.
          </p>
        ) : (
          allowedUsers.map((user) => (
            <article
              key={user.email}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              {editingEmail === user.email ? (
                <form className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto]" onSubmit={handleSaveUser}>
                  <label className="text-sm font-semibold text-slate-700">
                    Email
                    <input
                      type="email"
                      value={editForm.email}
                      disabled={user.protectedAdmin}
                      onChange={(event) =>
                        setEditForm((currentForm) => ({
                          ...currentForm,
                          email: event.target.value,
                        }))
                      }
                      required
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal"
                    />
                  </label>

                  <label className="flex items-center gap-2 pt-7 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={editForm.active}
                      disabled={user.protectedAdmin}
                      onChange={(event) =>
                        setEditForm((currentForm) => ({
                          ...currentForm,
                          active: event.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    Active
                  </label>

                  <label className="flex items-center gap-2 pt-7 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={editForm.admin}
                      disabled={user.protectedAdmin}
                      onChange={(event) =>
                        setEditForm((currentForm) => ({
                          ...currentForm,
                          admin: event.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    Admin
                  </label>

                  <div className="flex flex-wrap items-end gap-2">
                    <button
                      type="submit"
                      disabled={savingEmail === user.email}
                      className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingEmail === user.email ? "Saving..." : "Save"}
                    </button>

                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-500">
                      Email
                    </p>
                    <p className="break-all text-lg font-bold text-slate-900">
                      {user.email}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      active: {String(user.active)} · admin:{" "}
                      {String(user.admin)}
                    </p>
                    {user.protectedAdmin ? (
                      <p className="mt-2 inline-flex rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                        Support Admin
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(user)}
                      disabled={user.protectedAdmin}
                      className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteUser(user.email)}
                      disabled={deletingEmail === user.email || user.protectedAdmin}
                      className="rounded-xl border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deletingEmail === user.email ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              )}
            </article>
          ))
        )}
      </section>
    </div>
  );
}
