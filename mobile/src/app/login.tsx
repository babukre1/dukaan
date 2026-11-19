import { router } from 'expo-router'
import { Store } from 'lucide-react-native'
import { useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native'
import { SafeAreaView as NativeSafeAreaView } from 'react-native-safe-area-context'
import { withUniwind } from 'uniwind'
import { colors } from '@/constants/design'
import { useAuth } from '@/providers/auth'

const SafeAreaView = withUniwind(NativeSafeAreaView)

export default function Login() {
  const { login } = useAuth()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true)
    setError('')
    try {
      const session = await login(phone, password)
      if (session.user.platformRole !== 'OWNER') throw new Error('Use the admin portal for administrator accounts.')
      router.replace(session.user.mustChangePassword ? '/change-password' : '/')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return <SafeAreaView className="flex-1 bg-surface"><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-center p-7"><View className="h-[66px] w-[66px] self-center items-center justify-center rounded-[17px] bg-brand"><Store size={34} color="#fff"/></View><Text className="mt-4 text-center text-[27px] font-extrabold text-ink">DukaanFlow</Text><Text className="mb-[30px] mt-1.5 text-center text-[13px] text-muted">Small shop management for shop owners</Text><View className="gap-2">{error ? <Text className="rounded-lg bg-[#FBE3E5] p-2.5 text-[11px] text-danger">{error}</Text> : null}<Text className="mt-[7px] text-[11px] font-bold text-ink">Phone number</Text><TextInput value={phone} onChangeText={setPhone} className="h-12 rounded-[10px] border border-line px-[13px] text-sm text-ink" keyboardType="phone-pad" autoCapitalize="none" placeholder="+252 61 0000000"/><Text className="mt-[7px] text-[11px] font-bold text-ink">Password</Text><TextInput value={password} onChangeText={setPassword} className="h-12 rounded-[10px] border border-line px-[13px] text-sm text-ink" secureTextEntry/><Pressable disabled={busy} onPress={submit} className="mt-3.5 h-12 items-center justify-center rounded-[10px] bg-brand active:opacity-80">{busy ? <ActivityIndicator color="#fff"/> : <Text className="font-extrabold text-white">Log in</Text>}</Pressable></View></KeyboardAvoidingView></SafeAreaView>
}

