"use client";

import { useState } from "react";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { ExistingPhotoPicker } from "@/components/admin/existing-photo-picker";
import { createProductAction, updateProductAction } from "@/app/actions/products";
import {
  productFormSchema,
  type ProductFormInput,
} from "@/lib/validations/product";
import { slugify } from "@/lib/utils";
import { useExistingPhotos } from "@/lib/hooks/use-existing-photos";
import { usePhotoUpload } from "@/lib/hooks/use-photo-upload";
import type { Category, Product } from "@/lib/services/products/get-products";

interface ProductFormDialogProps {
  categories: Category[];
  product?: Product;
  trigger: React.ReactNode;
}

export function ProductFormDialog({
  categories,
  product,
  trigger,
}: ProductFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [slugTouched, setSlugTouched] = useState(!!product);
  const existingPhotos = useExistingPhotos(open);
  const { uploading, upload } = usePhotoUpload();

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ProductFormInput>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: product?.name ?? "",
      slug: product?.slug ?? "",
      categoryId: product?.category_id ?? null,
      imageUrl: product?.image_url ?? null,
      description: product?.description ?? "",
      isAvailable: product?.is_available ?? true,
      preparationNotice: product?.preparation_notice ?? "",
      allergens: product?.allergens ?? "",
      displayOrder: product?.display_order ?? 0,
      variants: product?.variants.length
        ? product.variants.map((v) => ({
            id: v.id,
            label: v.label,
            price: v.price,
            imageUrl: v.image_url,
            isAvailable: v.is_available,
            displayOrder: v.display_order,
          }))
        : [{ label: "", price: 0, imageUrl: null, isAvailable: true, displayOrder: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "variants" });

  async function handleFileChange(
    e: React.ChangeEvent<HTMLInputElement>,
    onChange: (url: string | null) => void,
  ) {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = await upload(file);
    if (url) onChange(url);
  }

  async function onSubmit(values: ProductFormInput) {
    setSubmitting(true);
    const result = product
      ? await updateProductAction(product.id, values)
      : await createProductAction(values);
    setSubmitting(false);

    if (!result.success) {
      toast.error(result.error ?? "Something went wrong.");
      return;
    }
    toast.success(product ? "Product updated." : "Product created.");
    setOpen(false);
    if (!product) {
      reset();
      setSlugTouched(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{product ? "Edit Product" : "New Product"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="name">Name</FieldLabel>
              <Input
                id="name"
                {...register("name")}
                onChange={(e) => {
                  setValue("name", e.target.value);
                  if (!slugTouched) {
                    setValue("slug", slugify(e.target.value));
                  }
                }}
              />
              <FieldError errors={[errors.name]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="slug">Slug</FieldLabel>
              <Input
                id="slug"
                {...register("slug")}
                onChange={(e) => {
                  setSlugTouched(true);
                  setValue("slug", e.target.value);
                }}
              />
              <FieldError errors={[errors.slug]} />
            </Field>

            <Controller
              control={control}
              name="categoryId"
              render={({ field }) => (
                <Field>
                  <FieldLabel>Category</FieldLabel>
                  <Select
                    value={field.value ?? "none"}
                    onValueChange={(v) => field.onChange(v === "none" ? null : v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No category</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />

            <Controller
              control={control}
              name="imageUrl"
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="image">Photo</FieldLabel>
                  {field.value && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={field.value}
                      alt=""
                      className="h-24 w-24 rounded-lg object-cover ring-1 ring-border"
                    />
                  )}
                  <div className="flex items-center gap-2">
                    <Input
                      id="image"
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      onChange={(e) => handleFileChange(e, field.onChange)}
                      disabled={uploading}
                    />
                    <ExistingPhotoPicker photos={existingPhotos} onSelect={field.onChange} />
                  </div>
                  {uploading && (
                    <p className="text-sm text-muted-foreground">Uploading…</p>
                  )}
                  <FieldError errors={[errors.imageUrl]} />
                </Field>
              )}
            />

            <Field>
              <FieldLabel>Sizes</FieldLabel>
              <div className="flex flex-col gap-3">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <FieldLabel htmlFor={`variants.${index}.label`} className="text-xs font-normal text-muted-foreground">
                          Label
                        </FieldLabel>
                        <Input
                          id={`variants.${index}.label`}
                          placeholder="e.g. Piece, 9&quot;, 12 Piece"
                          {...register(`variants.${index}.label` as const)}
                        />
                      </div>
                      <div className="w-24">
                        <FieldLabel htmlFor={`variants.${index}.price`} className="text-xs font-normal text-muted-foreground">
                          Price
                        </FieldLabel>
                        <Input
                          id={`variants.${index}.price`}
                          type="number"
                          step="0.01"
                          min={0}
                          {...register(`variants.${index}.price` as const)}
                        />
                      </div>
                      <Controller
                        control={control}
                        name={`variants.${index}.isAvailable` as const}
                        render={({ field: availableField }) => (
                          <Switch
                            aria-label={`Size ${index + 1} available`}
                            checked={availableField.value}
                            onCheckedChange={availableField.onChange}
                            className="mb-2"
                          />
                        )}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={fields.length === 1}
                        onClick={() => remove(index)}
                        aria-label="Remove size"
                      >
                        <X />
                      </Button>
                    </div>

                    <Controller
                      control={control}
                      name={`variants.${index}.imageUrl` as const}
                      render={({ field: imageField }) => (
                        <div className="flex items-center gap-2">
                          {imageField.value && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={imageField.value}
                              alt=""
                              className="size-10 shrink-0 rounded-md object-cover ring-1 ring-border"
                            />
                          )}
                          <Input
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/gif"
                            onChange={(e) => handleFileChange(e, imageField.onChange)}
                            disabled={uploading}
                            className="text-xs"
                          />
                          <ExistingPhotoPicker
                            photos={existingPhotos}
                            onSelect={imageField.onChange}
                            compact
                          />
                          {imageField.value && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => imageField.onChange(null)}
                            >
                              Clear
                            </Button>
                          )}
                        </div>
                      )}
                    />
                    <p className="text-xs text-muted-foreground">
                      Optional — only set this if this size actually looks different. Otherwise it uses the product photo above.
                    </p>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 self-start"
                onClick={() =>
                  append({
                    label: "",
                    price: 0,
                    imageUrl: null,
                    isAvailable: true,
                    displayOrder: fields.length,
                  })
                }
              >
                <Plus /> Add size
              </Button>
              <FieldError errors={[errors.variants?.root ?? errors.variants]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="description">Description</FieldLabel>
              <Textarea id="description" rows={3} {...register("description")} />
              <FieldError errors={[errors.description]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="allergens">Allergens</FieldLabel>
              <Input id="allergens" placeholder="Contains gluten, dairy" {...register("allergens")} />
            </Field>

            <Field>
              <FieldLabel htmlFor="preparationNotice">Preparation notice</FieldLabel>
              <Input id="preparationNotice" {...register("preparationNotice")} />
            </Field>

            <Field>
              <FieldLabel htmlFor="displayOrder">Display order</FieldLabel>
              <Input id="displayOrder" type="number" min={0} {...register("displayOrder")} />
            </Field>

            <Controller
              control={control}
              name="isAvailable"
              render={({ field }) => (
                <Field orientation="horizontal">
                  <FieldLabel htmlFor="isAvailable">
                    Visible on storefront
                    <span className="block text-xs font-normal text-muted-foreground">
                      Master switch — off hides every size, regardless of their own availability.
                    </span>
                  </FieldLabel>
                  <Switch
                    id="isAvailable"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </Field>
              )}
            />
          </FieldGroup>

          <DialogFooter className="mt-4">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : product ? "Save Changes" : "Create Product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
