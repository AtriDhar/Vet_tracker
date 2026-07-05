"use client";

import { use, useEffect, useState } from "react";
import PetForm, { type PetFormValues } from "@/components/PetForm";
import { api } from "@/lib/client";
import { Spinner } from "@/components/ui";

export default function EditPetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [initial, setInitial] = useState<Partial<PetFormValues> | null>(null);

  useEffect(() => {
    api<{ pet: Record<string, unknown> }>(`/api/pets/${id}`).then(({ pet }) =>
      setInitial({
        name: (pet.name as string) ?? "",
        species: (pet.species as string) ?? "dog",
        breed: (pet.breed as string) ?? "",
        sex: (pet.sex as string) ?? "",
        birth_date: (pet.birth_date as string) ?? "",
        weight_kg: pet.weight_kg != null ? String(pet.weight_kg) : "",
        photo: (pet.photo as string) ?? "🐾",
        notes: (pet.notes as string) ?? "",
      })
    );
  }, [id]);

  if (!initial) return <Spinner />;
  return <PetForm petId={Number(id)} initial={initial} />;
}
