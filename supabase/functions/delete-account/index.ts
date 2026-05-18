import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    // 유저 토큰으로 현재 로그인 유저 확인
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    // Service Role로 데이터 삭제
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const userId = user.id

    // 1. workout_sets 삭제 (workout_entries 통해서)
    const { data: entries } = await supabaseAdmin
      .from('workout_entries')
      .select('id')
      .in(
        'session_id',
        (await supabaseAdmin
          .from('workout_sessions')
          .select('id')
          .eq('user_id', userId)
        ).data?.map((s: any) => s.id) ?? []
      )
    if (entries?.length) {
      await supabaseAdmin
        .from('workout_sets')
        .delete()
        .in('entry_id', entries.map((e: any) => e.id))
    }

    // 2. workout_entries 삭제
    const { data: sessions } = await supabaseAdmin
      .from('workout_sessions')
      .select('id')
      .eq('user_id', userId)
    if (sessions?.length) {
      await supabaseAdmin
        .from('workout_entries')
        .delete()
        .in('session_id', sessions.map((s: any) => s.id))
    }

    // 3. workout_sessions 삭제
    await supabaseAdmin
      .from('workout_sessions')
      .delete()
      .eq('user_id', userId)

    // 4. workout_feed_posts 삭제
    await supabaseAdmin
      .from('workout_feed_posts')
      .delete()
      .eq('user_id', userId)

    // 5. workout_photos 삭제
    await supabaseAdmin
      .from('workout_photos')
      .delete()
      .eq('user_id', userId)

    // 6. machine_reviews 삭제
    await supabaseAdmin
      .from('machine_reviews')
      .delete()
      .eq('user_id', userId)

    // 7. favorite_machines 삭제
    await supabaseAdmin
      .from('favorite_machines')
      .delete()
      .eq('user_id', userId)

    // 8. gym_registration_requests 삭제
    await supabaseAdmin
      .from('gym_registration_requests')
      .delete()
      .eq('user_id', userId)

    // 9. 매니저 계정인 경우: gyms.manager_id를 null로 업데이트 (헬스장은 유지)
    await supabaseAdmin
      .from('gyms')
      .update({ manager_id: null })
      .eq('manager_id', userId)

    // 10. Storage 파일 삭제 (profile-images, workout-photos, gym-photos)
    try {
      const { data: profileFiles } = await supabaseAdmin.storage
        .from('profile-images')
        .list(userId)
      if (profileFiles?.length) {
        await supabaseAdmin.storage
          .from('profile-images')
          .remove(profileFiles.map((f: any) => `${userId}/${f.name}`))
      }
    } catch {}

    try {
      const { data: photoFiles } = await supabaseAdmin.storage
        .from('workout-photos')
        .list(userId)
      if (photoFiles?.length) {
        await supabaseAdmin.storage
          .from('workout-photos')
          .remove(photoFiles.map((f: any) => `${userId}/${f.name}`))
      }
    } catch {}

    try {
      const { data: gymPhotoFiles } = await supabaseAdmin.storage
        .from('gym-photos')
        .list(userId)
      if (gymPhotoFiles?.length) {
        await supabaseAdmin.storage
          .from('gym-photos')
          .remove(gymPhotoFiles.map((f: any) => `${userId}/${f.name}`))
      }
    } catch {}

    // 11. profiles 삭제
    await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId)

    // 12. auth.users에서 계정 삭제
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (deleteError) {
      return new Response(JSON.stringify({ error: deleteError.message }), { status: 500 })
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 })
  }
})
