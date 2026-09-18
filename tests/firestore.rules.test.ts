/** @jest-environment node */
// @ts-nocheck
import { initializeTestEnvironment, RulesTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { readFileSync } from 'fs'
import { setLogLevel, doc, getDoc, setDoc, collection, addDoc, deleteDoc, Timestamp } from 'firebase/firestore'

let testEnv: RulesTestEnvironment

beforeAll(async () => {
  setLogLevel('error')
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-santashelper-rules-test',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
    },
  })
})

afterEach(async () => {
  await testEnv.clearFirestore()
})

afterAll(async () => {
  await testEnv.cleanup()
})

describe('Family document (parent PIN + settings live here directly)', () => {
  test('owning parent can read their family doc', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'families/parent-1'), { familyCode: 'ABC123', parentPinHash: 'hash' })
    })
    const db = testEnv.authenticatedContext('parent-1', { role: 'parent' }).firestore()
    await assertSucceeds(getDoc(doc(db, 'families/parent-1')))
  })

  test('a different parent cannot read someone else\'s family doc', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'families/parent-1'), { familyCode: 'ABC123' })
    })
    const db = testEnv.authenticatedContext('parent-2', { role: 'parent' }).firestore()
    await assertFails(getDoc(doc(db, 'families/parent-1')))
  })

  test('the parent PIN hash can never be written by a client, even the owner', async () => {
    const db = testEnv.authenticatedContext('parent-1', { role: 'parent' }).firestore()
    await assertFails(setDoc(doc(db, 'families/parent-1'), { parentPinHash: 'newhash' }, { merge: true }))
  })
})

describe('Children + wishlist/deeds (owner parent vs. linked child)', () => {
  const familyId = 'parent-1'
  const childId = 'child-1'
  const linkedChildUid = 'anon-linked-uid'

  test('owning parent has full read/write on their child', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `users/${familyId}/children/${childId}`), { name: 'Buddy' })
    })
    const db = testEnv.authenticatedContext(familyId, { role: 'parent' }).firestore()
    await assertSucceeds(getDoc(doc(db, `users/${familyId}/children/${childId}`)))
    await assertSucceeds(setDoc(doc(db, `users/${familyId}/children/${childId}`), { name: 'Buddy Jr.' }, { merge: true }))
  })

  test('a random authenticated user cannot read another family\'s child', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `users/${familyId}/children/${childId}`), { name: 'Buddy' })
    })
    const db = testEnv.authenticatedContext('stranger', { role: 'parent' }).firestore()
    await assertFails(getDoc(doc(db, `users/${familyId}/children/${childId}`)))
  })

  test('a linked child session can add to the wishlist and log a deed, but not delete', async () => {
    let seededGiftId = ''
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const adminDb = ctx.firestore()
      await setDoc(doc(adminDb, `users/${familyId}/children/${childId}`), { name: 'Buddy' })
      await setDoc(doc(adminDb, `families/${familyId}/childSessions/${linkedChildUid}`), {
        allowedChildId: childId,
        expireAt: Timestamp.fromMillis(Date.now() + 60 * 60 * 1000),
      })
      const ref = await addDoc(collection(adminDb, `users/${familyId}/children/${childId}/wishlist`), { name: 'seeded' })
      seededGiftId = ref.id
    })

    const db = testEnv.authenticatedContext(linkedChildUid).firestore()
    const wishlistCol = collection(db, `users/${familyId}/children/${childId}/wishlist`)
    await assertSucceeds(addDoc(wishlistCol, { name: 'A rocket sled' }))

    const deedsCol = collection(db, `users/${familyId}/children/${childId}/deeds`)
    await assertSucceeds(addDoc(deedsCol, { description: 'Helped a sibling' }))

    await assertFails(deleteDoc(doc(db, `users/${familyId}/children/${childId}/wishlist/${seededGiftId}`)))
  })

  test('an unlinked (no active child session) caller cannot read the wishlist', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `users/${familyId}/children/${childId}`), { name: 'Buddy' })
    })
    const db = testEnv.authenticatedContext('some-other-anon-uid').firestore()
    await assertFails(getDoc(doc(db, `users/${familyId}/children/${childId}/wishlist/anything`)))
  })

  test('an expired child session no longer grants access', async () => {
    const expiredUid = 'anon-expired-uid'
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const adminDb = ctx.firestore()
      await setDoc(doc(adminDb, `users/${familyId}/children/${childId}`), { name: 'Buddy' })
      await setDoc(doc(adminDb, `families/${familyId}/childSessions/${expiredUid}`), {
        allowedChildId: childId,
        expireAt: Timestamp.fromMillis(Date.now() - 1000), // already expired
      })
    })
    const db = testEnv.authenticatedContext(expiredUid).firestore()
    await assertFails(getDoc(doc(db, `users/${familyId}/children/${childId}`)))
  })
})

describe('Users: role field cannot be self-escalated', () => {
  test('a parent cannot set their own role field', async () => {
    const db = testEnv.authenticatedContext('parent-1', { role: 'parent' }).firestore()
    await assertFails(setDoc(doc(db, 'users/parent-1'), { role: 'admin' }, { merge: true }))
  })

  test('an admin-flagged caller can mirror a role change', async () => {
    // Mirroring an update requires the doc to already exist -- an admin claim
    // only grants `update`, not `create`, per the rules.
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users/parent-1'), { email: 'p@example.com', role: 'unset' })
    })
    const db = testEnv.authenticatedContext('parent-1', { admin: true }).firestore()
    await assertSucceeds(setDoc(doc(db, 'users/parent-1'), { role: 'parent' }, { merge: true }))
  })
})

describe('Share links: only the owning parent can manage their own tokens', () => {
  test('the owning parent can read their share token', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'shareTokens/parent-1_child-1'), { parentId: 'parent-1', childId: 'child-1', token: 'abc' })
    })
    const db = testEnv.authenticatedContext('parent-1', { role: 'parent' }).firestore()
    await assertSucceeds(getDoc(doc(db, 'shareTokens/parent-1_child-1')))
  })

  test('a different parent cannot read someone else\'s share token', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'shareTokens/parent-1_child-1'), { parentId: 'parent-1', childId: 'child-1', token: 'abc' })
    })
    const db = testEnv.authenticatedContext('parent-2', { role: 'parent' }).firestore()
    await assertFails(getDoc(doc(db, 'shareTokens/parent-1_child-1')))
  })

  test('an unauthenticated visitor cannot read a share token directly', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'shareTokens/parent-1_child-1'), { parentId: 'parent-1', childId: 'child-1', token: 'abc' })
    })
    const db = testEnv.unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(db, 'shareTokens/parent-1_child-1')))
  })
})

describe('Anonymous scratch space (try Santa before linking)', () => {
  test('an anonymous user can read/write their own scratch space', async () => {
    const db = testEnv.authenticatedContext('anon-1', { firebase: { sign_in_provider: 'anonymous' } }).firestore()
    await assertSucceeds(setDoc(doc(db, 'users/anon-1/anonSanta/data'), { pinStatus: 'n/a' }))
  })

  test('an anonymous user cannot read another anonymous user\'s scratch space', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users/anon-1/anonSanta/data'), { foo: 'bar' })
    })
    const db = testEnv.authenticatedContext('anon-2', { firebase: { sign_in_provider: 'anonymous' } }).firestore()
    await assertFails(getDoc(doc(db, 'users/anon-1/anonSanta/data')))
  })
})
