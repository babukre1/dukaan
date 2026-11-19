import { router } from 'expo-router'
import { useState } from 'react'
import { Text, TextInput, View } from 'react-native'
import { PrimaryButton, Screen } from '@/components/ui'
import { mobileApi } from '@/lib/api'
import { useAuth } from '@/providers/auth'

export default function ChangePassword() {
  const { logout } = useAuth()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    setError('')
    try {
      await mobileApi.changePassword(current, next)
      await logout()
      router.replace('/login')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not change password')
    } finally {
      setBusy(false)
    }
  }

  return <Screen title="Change password" bottomNav={false}><View className="mb-4 rounded-xl bg-brand-soft p-[15px]"><Text className="text-[15px] font-extrabold text-ink">Create your private password</Text><Text className="mt-1 text-[11px] leading-[17px] text-muted">For security, the temporary password must be changed before using the app.</Text></View>{error ? <Text className="mb-3 rounded-lg bg-[#FBE3E5] p-2.5 text-[11px] text-danger">{error}</Text> : null}<Text className="mb-1.5 text-[11px] font-bold text-ink">Temporary password</Text><TextInput secureTextEntry value={current} onChangeText={setCurrent} className="mb-3.5 h-12 rounded-[10px] border border-line px-3"/><Text className="mb-1.5 text-[11px] font-bold text-ink">New password</Text><TextInput secureTextEntry value={next} onChangeText={setNext} className="mb-3.5 h-12 rounded-[10px] border border-line px-3"/><Text className="-mt-[7px] mb-4 text-[10px] text-muted">At least 10 characters with upper-case, lower-case, and a number.</Text><PrimaryButton onPress={save}>{busy ? 'Saving...' : 'Change password'}</PrimaryButton></Screen>
}

