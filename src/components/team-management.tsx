import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { UserRole, USER_CACHE_KEY } from "../lib/authContext";
import LoadingSpinner from "./LoadingSpinner";
// ... existing code ... 