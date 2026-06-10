import axios from "axios"
import { useAuth } from "@clerk/clerk-react"
import { useMemo } from "react"

/**
 * Creates an Axios instance with Clerk JWT attached to every request.
 */
export function useApiClient() {
  const { getToken } = useAuth()

  return useMemo(() => {
    const client = axios.create({
      baseURL: import.meta.env.VITE_API_URL,
    })

    client.interceptors.request.use(async config => {
      const token = await getToken()
      if (token) config.headers.Authorization = `Bearer ${token}`
      return config
    })

    return client
  }, [getToken])
}
