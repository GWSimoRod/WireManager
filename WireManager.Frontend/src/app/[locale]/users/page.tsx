"use client";

import { useState, useEffect, useCallback, type FormEvent } from "react";
import {
  UserPlus,
  User,
  Lock,
  Loader2,
  Eye,
  EyeOff,
  ShieldAlert,
  Shield,
  ChevronDown,
  Users,
  Search,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AuthenticatedLayout } from "@/components/authenticated-layout";
import { useAuth } from "@/lib/auth-context";
import { createUser, getAllUsers, deleteUser, updateUserRole, ApiClientError } from "@/lib/api-client";
import type { UserInfo } from "@/lib/types";
import { useTranslations } from "next-intl";

const roleBadgeColors: Record<string, string> = {
  Admin: "bg-red-500/15 text-red-400 border-red-500/20",
  Operator: "bg-amber-500/15 text-amber-400 border-amber-500/20",
};

export default function UsersPage() {
  const tUsers = useTranslations("Users");
  const tCommon = useTranslations("Common");
  const tAuth = useTranslations("Auth");

  const ROLES = [
    { value: "Admin", label: tUsers("admin"), description: tUsers("adminDesc") },
    { value: "Operator", label: tUsers("operator"), description: tUsers("operatorDesc") },
  ] as const;
  const { userRole, username: currentUser } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("Operator");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRoleOpen, setIsRoleOpen] = useState(false);

  const [users, setUsers] = useState<UserInfo[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [totalCount, setTotalCount] = useState<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (debouncedSearchQuery !== searchQuery) {
        setDebouncedSearchQuery(searchQuery);
        setCurrentPage(1);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, debouncedSearchQuery]);

  const fetchUsers = useCallback(async () => {
    if (userRole !== "Admin") return;
    try {
      setIsLoadingUsers(true);

      const isCurrentUserMatchingSearch = Boolean(
        currentUser && (!debouncedSearchQuery || currentUser.toLowerCase().includes(debouncedSearchQuery.toLowerCase()))
      );

      let start = 0;
      let end = 0;

      if (isCurrentUserMatchingSearch) {
        if (currentPage === 1) {
          start = 0;
          end = pageSize - 1; // Richiede solo 4 utenti dal backend per fare spazio a quello loggato (totale 5)
        } else {
          start = (pageSize - 1) + (currentPage - 2) * pageSize;
          end = start + pageSize; // Richiede 5 utenti, slittando di 1 posizione
        }
      } else {
        start = (currentPage - 1) * pageSize;
        end = start + pageSize;
      }

      const result = await getAllUsers(start, end, debouncedSearchQuery);
      
      let finalUsers = result.data;
      let finalTotalCount = result.totalCount;
      
      // Il backend esclude l'utente loggato dai risultati, ma il suo totalCount lo include già.
      // Lo aggiungiamo manualmente in cima alla prima pagina.
      if (isCurrentUserMatchingSearch) {
        if (currentPage === 1 && currentUser && userRole) {
          finalUsers = [
            {
              uuid: "current-user-uuid",
              username: currentUser,
              role: userRole,
            },
            ...result.data,
          ];
        }
      }
      
      setUsers(finalUsers);
      setTotalCount(finalTotalCount);
    } catch (err) {
      toast.error(tUsers("loadError"));
    } finally {
      setIsLoadingUsers(false);
    }
  }, [userRole, currentUser, currentPage, pageSize, debouncedSearchQuery]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  function validate(): boolean {
    if (username.trim().length < 3) {
      toast.error(tUsers("usernameLengthError"));
      return false;
    }
    if (password.length < 6) {
      toast.error(tUsers("passwordLengthError"));
      return false;
    }
    if (!role) {
      toast.error(tUsers("roleRequired"));
      return false;
    }
    return true;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await createUser({
        Username: username.trim(),
        Password: password,
        Role: role,
      });
      toast.success(tUsers("created", { username: username.trim() }));
      setUsername("");
      setPassword("");
      setRole("Operator");
      await fetchUsers(); // Refresh the list
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? err.message
          : tUsers("createError");
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(uuid: string, username: string) {
    if (!confirm(tUsers("deleteConfirm", { username }))) return;
    try {
      await deleteUser(uuid);
      toast.success(tUsers("deleted", { username }));
      await fetchUsers(); // Refresh the list
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? err.message
          : tUsers("deleteError");
      toast.error(message);
    }
  }

  async function handleRoleChange(uuid: string, username: string, newRole: string) {
    if (!confirm(tUsers("changeRoleConfirm", { username, role: newRole }))) return;
    try {
      await updateUserRole(uuid, newRole);
      toast.success(tUsers("roleChanged", { username, role: newRole }));
      await fetchUsers(); // Refresh the list
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? err.message
          : tUsers("changeRoleError");
      toast.error(message);
    }
  }

  return (
    <AuthenticatedLayout>
      <div className="animate-fade-in space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
            {tUsers("title")}
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            {tUsers("subtitle")}
          </p>
        </div>

        {userRole !== "Admin" ? (
          /* ─── Access Denied ─── */
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 py-20">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10">
              <ShieldAlert className="h-8 w-8 text-red-400" />
            </div>
            <p className="mt-4 text-sm font-medium text-zinc-300">
              {tCommon("accessDenied")}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {tUsers("adminOnly")}
            </p>
          </div>
        ) : (
          /* ─── Admin Content ─── */
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            
            {/* ─── Create Account Form ─── */}
            <div className="lg:col-span-5">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 shadow-xl backdrop-blur-xl">
                {/* Form Header */}
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20">
                    <UserPlus className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-zinc-100">
                      {tUsers("newAccount")}
                    </h2>
                    <p className="text-xs text-zinc-400">
                      {tUsers("newAccountDesc")}
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Username */}
                  <div>
                    <Label
                      htmlFor="create-username"
                      className="text-xs text-zinc-400 mb-1.5 block"
                    >
                      {tAuth("username")}
                    </Label>
                    <div className="relative">
                      <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                      <Input
                        id="create-username"
                        type="text"
                        placeholder={tAuth("username")}
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="pl-10 bg-zinc-800/50 border-zinc-700 placeholder:text-zinc-600 focus:border-blue-500 focus:ring-blue-500/20"
                        autoComplete="off"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <Label
                      htmlFor="create-password"
                      className="text-xs text-zinc-400 mb-1.5 block"
                    >
                      {tAuth("password")}
                    </Label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                      <Input
                        id="create-password"
                        type={showPassword ? "text" : "password"}
                        placeholder={tUsers("passwordLengthError")}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 pr-10 bg-zinc-800/50 border-zinc-700 placeholder:text-zinc-600 focus:border-blue-500 focus:ring-blue-500/20"
                        autoComplete="new-password"
                        disabled={isSubmitting}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Role */}
                  <div>
                    <Label className="text-xs text-zinc-400 mb-1.5 block">
                      {tUsers("role")}
                    </Label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsRoleOpen(!isRoleOpen)}
                        className="flex w-full items-center justify-between rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 transition-colors hover:border-zinc-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={isSubmitting}
                      >
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-zinc-500" />
                          <span>{ROLES.find((r) => r.value === role)?.label ?? tUsers("selectRole")}</span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 ${roleBadgeColors[role] || ""}`}
                          >
                            {role}
                          </Badge>
                        </div>
                        <ChevronDown
                          className={`h-4 w-4 text-zinc-500 transition-transform ${isRoleOpen ? "rotate-180" : ""}`}
                        />
                      </button>

                      {isRoleOpen && (
                        <div className="absolute z-50 mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl">
                          {ROLES.map((r) => (
                            <button
                              key={r.value}
                              type="button"
                              onClick={() => {
                                setRole(r.value);
                                setIsRoleOpen(false);
                              }}
                              className={`flex w-full items-center justify-between px-3 py-2.5 text-sm transition-colors hover:bg-zinc-800 first:rounded-t-lg last:rounded-b-lg ${
                                role === r.value
                                  ? "bg-blue-600/10 text-blue-400"
                                  : "text-zinc-300"
                              }`}
                            >
                              <div className="flex flex-col items-start">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{r.label}</span>
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] px-1.5 py-0 ${roleBadgeColors[r.value]}`}
                                  >
                                    {r.value}
                                  </Badge>
                                </div>
                                <span className="text-xs text-zinc-500">
                                  {r.description}
                                </span>
                              </div>
                              {role === r.value && (
                                <div className="h-2 w-2 rounded-full bg-blue-500" />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Submit */}
                  <Button
                    id="create-user-submit"
                    type="submit"
                    className="w-full cursor-pointer bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-500 hover:to-blue-600 shadow-lg shadow-blue-600/20 transition-all duration-200"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {tUsers("creating")}
                      </>
                    ) : (
                      <>
                        <UserPlus className="mr-2 h-4 w-4" />
                        {tUsers("createAccount")}
                      </>
                    )}
                  </Button>
                </form>
              </div>
            </div>

            {/* ─── Users List ─── */}
            <div className="lg:col-span-7">
              <div className="flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 shadow-xl backdrop-blur-xl h-full max-h-[650px]">
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800 text-zinc-400 shadow-inner">
                      <Users className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-zinc-100">
                        {tUsers("registeredUsers")}
                      </h2>
                      <p className="text-xs text-zinc-400">
                        {tUsers("totalAccounts", { count: users.length })}
                      </p>
                    </div>
                  </div>
                  
                  {/* Search Input */}
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    <Input
                      type="text"
                      placeholder={tUsers("searchUser")}
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="h-9 w-full rounded-lg border-zinc-700 bg-zinc-800/50 pl-9 text-sm placeholder:text-zinc-500 focus:border-blue-500 focus:ring-blue-500/20"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-3 custom-scrollbar">
                  {isLoadingUsers ? (
                    <div className="flex h-40 items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
                    </div>
                  ) : users.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <Users className="h-10 w-10 text-zinc-600 mb-3" />
                      <p className="text-sm font-medium text-zinc-300">
                        {searchQuery ? tUsers("noUserFound") : tUsers("noUsers")}
                      </p>
                    </div>
                  ) : (
                    users.map((user) => (
                      <div
                        key={user.username}
                        className={`flex items-center justify-between rounded-xl border p-4 transition-colors ${
                          user.username === currentUser
                            ? "border-blue-500/30 bg-blue-500/5 shadow-sm shadow-blue-500/10"
                            : "border-zinc-800/80 bg-zinc-900/50 hover:bg-zinc-800/50 hover:border-zinc-700"
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${
                              user.username === currentUser
                                ? "border-blue-500/20 bg-blue-500/10 text-blue-400"
                                : "border-zinc-700 bg-zinc-800 text-zinc-400"
                            }`}
                          >
                            <User className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-medium text-zinc-100">
                                {user.username}
                              </span>
                              {user.username === currentUser && (
                                <Badge
                                  variant="secondary"
                                  className="bg-blue-500/10 text-[10px] text-blue-400 hover:bg-blue-500/10"
                                >
                                  {tUsers("you")}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {user.username !== currentUser ? (
                            <div className="relative">
                              <select
                                value={user.role}
                                onChange={(e) => handleRoleChange(user.uuid, user.username, e.target.value)}
                                className={`appearance-none cursor-pointer rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50 pr-6 ${roleBadgeColors[user.role] || "bg-zinc-800 text-zinc-400 border-zinc-700"}`}
                              >
                                {ROLES.map(r => (
                                  <option key={r.value} value={r.value} className="bg-zinc-900 text-zinc-300">
                                    {r.label}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 opacity-50" />
                            </div>
                          ) : (
                            <Badge
                              variant="outline"
                              className={`${roleBadgeColors[user.role] || "bg-zinc-800 text-zinc-400 border-zinc-700"}`}
                            >
                              {user.role}
                            </Badge>
                          )}
                          
                          {user.username !== currentUser && (
                            <button
                              onClick={() => handleDelete(user.uuid, user.username)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
                              title={tUsers("deleteAccount")}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                          {user.username === currentUser && (
                            <div className="h-8 w-8" /> /* Empty space to maintain alignment */
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Pagination Controls */}
                {!isLoadingUsers && users.length > 0 && (
                  <div className="mt-4 flex items-center justify-between border-t border-zinc-800 pt-4">
                    <p className="text-xs text-zinc-400">
                      {totalCount !== null ? (
                        tUsers("paginationTotal", { page: currentPage, totalPages: Math.max(1, Math.ceil(totalCount / pageSize)), total: totalCount })
                      ) : (
                        tUsers("pagination", { page: currentPage })
                      )}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="h-8 w-8 p-0 border-zinc-700 bg-zinc-800/50 hover:bg-zinc-700 text-zinc-300 disabled:opacity-50"
                      >
                        <span className="sr-only">{tUsers("previous")}</span>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => p + 1)}
                        disabled={totalCount !== null ? currentPage >= Math.ceil(totalCount / pageSize) : users.length < pageSize}
                        className="h-8 w-8 p-0 border-zinc-700 bg-zinc-800/50 hover:bg-zinc-700 text-zinc-300 disabled:opacity-50"
                      >
                        <span className="sr-only">{tUsers("next")}</span>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
