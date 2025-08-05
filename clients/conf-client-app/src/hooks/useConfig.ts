import { useContext } from "react";
import { ConfigContext } from "../contexts/ConfigContext";

export function useConfig() {
  const config = useContext(ConfigContext);
  if (!config) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return config;
}