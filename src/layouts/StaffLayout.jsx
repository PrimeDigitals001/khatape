import StaffTopbar from "../components/StaffTopbar";
import { Outlet } from "react-router-dom";

export default function StaffLayout() {
  return (
    <div className="w-screen h-screen overflow-hidden flex flex-col">
      {/* Topbar - Full Width */}
      <StaffTopbar />
      
      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}