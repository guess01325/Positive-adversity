import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import AdminRoute from "./components/AdminRoute";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import AdminPage from "./pages/AdminPage";
import ProfilePage from "./pages/ProfilePage";
import NotFoundPage from "./pages/NotFoundPage";
import { useAuth } from "./contexts/AuthContext";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import HomePage from "./pages/HomePage";
import Mission from "./pages/Misson";
import MainPageLayout from "./components/MainPageLayout";
import Store from "./pages/Store";
import CheckoutSuccessPage from "./pages/CheckoutSuccessPage";
import CheckoutCancelPage from "./pages/CheckoutCancelPage";
import OrderLookupPage from "./pages/OrderLookupPage";
import AdminOrderPage from "./pages/AdminOrderPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import Events from "./pages/Events";
import AdminEventsPage from "./pages/AdminEventsPage";
import AdminProductsPage from "./pages/AdminProductsPage";

export default function App() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      StatusBar.setOverlaysWebView({ overlay: false });
      StatusBar.setBackgroundColor({ color: "#0f172a" });
      StatusBar.setStyle({ style: Style.Dark });
    }
  }, []);

  if (loading) {
    return <div style={{ padding: 24, fontSize: 18 }}>App loading...</div>;
  }

  return (
    <Routes>
      {!user ? (
        <>
            <Route path="/" element={<HomePage />} />
          <Route path="/" element={<MainPageLayout />}>

            <Route path="/store" element={<Store />} />
            <Route path="/store/order-lookup" element={<OrderLookupPage />} />
            <Route
              path="/store/checkout/success"
              element={<CheckoutSuccessPage />}
            />
            <Route
              path="/store/checkout/cancel"
              element={<CheckoutCancelPage />}
            />
            <Route path="/events" element={<Events />} />

            <Route path="/login" element={<LoginPage />} />
            <Route path="/mission" element={<Mission />} />

            <Route path="*" element={<Navigate to="/login" replace />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </>
      ) : (
        <>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="store" element={<Store />} />
            <Route path="store/order-lookup" element={<OrderLookupPage />} />
            <Route
              path="store/checkout/success"
              element={<CheckoutSuccessPage />}
            />
            <Route
              path="store/checkout/cancel"
              element={<CheckoutCancelPage />}
            />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="events" element={<Events />} />
            <Route
              path="admin"
              element={
                <AdminRoute>
                  <AdminPage />
                </AdminRoute>
              }
            />
            <Route
              path="admin/orders"
              element={
                <AdminRoute>
                  <AdminOrderPage />
                </AdminRoute>
              }
            />
            <Route
              path="admin/users"
              element={
                <AdminRoute>
                  <AdminUsersPage />
                </AdminRoute>
              }
            />
            <Route
              path="admin/events"
              element={
                <AdminRoute>
                  <AdminEventsPage />
                </AdminRoute>
              }
            />
            <Route
              path="admin/products"
              element={
                <AdminRoute>
                  <AdminProductsPage />
                </AdminRoute>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </>
      )}
    </Routes>
  );
}
