import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("discover", "routes/discover.tsx"),
  route("login", "routes/login.tsx"),
  route("signup", "routes/signup.tsx"),
  route("compare", "routes/compare.tsx"),
  route("profile", "routes/profile.tsx"),
  route("admin", "routes/admin.tsx"),
  route("rankings/:metric", "routes/ranking.tsx"),
  route("restaurants/:restaurantId", "routes/restaurant.tsx"),
  route("meals/:mealKey", "routes/meal.tsx"),
] satisfies RouteConfig;
