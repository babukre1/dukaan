import * as SecureStore from 'expo-secure-store'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { mobileApi, type CurrentUser, type MobileSession } from '@/lib/api'

const REFRESH_KEY = 'dukaanflow.refresh-token'
type AuthValue = { session: MobileSession | null; profile: CurrentUser | null; loading: boolean; login(phone: string, password: string): Promise<MobileSession>; logout(): Promise<void>; reloadProfile(): Promise<void> }
const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({children}:{children:ReactNode}) {
  const [session,setSession]=useState<MobileSession|null>(null);const[profile,setProfile]=useState<CurrentUser|null>(null);const[loading,setLoading]=useState(true)
  const apply=useCallback(async(next:MobileSession)=>{mobileApi.setAccessToken(next.accessToken);await SecureStore.setItemAsync(REFRESH_KEY,next.refreshToken);setSession(next);setProfile(await mobileApi.me())},[])
  useEffect(()=>{SecureStore.getItemAsync(REFRESH_KEY).then(async token=>{if(token)await apply(await mobileApi.refresh(token))}).catch(()=>SecureStore.deleteItemAsync(REFRESH_KEY)).finally(()=>setLoading(false))},[apply])
  const login=useCallback(async(phone:string,password:string)=>{const next=await mobileApi.login(phone,password);await apply(next);return next},[apply])
  const logout=useCallback(async()=>{const token=session?.refreshToken;setSession(null);setProfile(null);mobileApi.setAccessToken('');await SecureStore.deleteItemAsync(REFRESH_KEY);if(token)await mobileApi.logout(token).catch(()=>undefined)},[session?.refreshToken])
  const reloadProfile=useCallback(async()=>{setProfile(await mobileApi.me())},[])
  const value=useMemo(()=>({session,profile,loading,login,logout,reloadProfile}),[session,profile,loading,login,logout,reloadProfile])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
export function useAuth(){const value=useContext(AuthContext);if(!value)throw new Error('useAuth must be used inside AuthProvider');return value}
