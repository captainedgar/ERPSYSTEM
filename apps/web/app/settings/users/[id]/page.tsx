'use client';

import { useParams } from 'next/navigation';

import { UserFormPage } from '@/components/users-manager';

export default function EditUserPage() {
  const params = useParams<{ id: string }>();
  return <UserFormPage userId={params.id} />;
}
