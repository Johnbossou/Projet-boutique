<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Http\Exceptions\HttpResponseException;

class ProduitRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $rules = [
            'nom' => 'required|string|max:255',
            'description' => 'nullable|string|max:1000',
            'prix' => 'required|numeric|min:0',
            'quantite_stock' => 'required|integer|min:0',
            'seuil_alerte' => 'required|integer|min:0',
            'categorie_id' => 'nullable|integer|exists:categories,id',
            'image' => 'nullable|string|max:500',
        ];

        // Pour la mise à jour, le nom peut être unique sauf pour le produit actuel
        if ($this->isMethod('put') || $this->isMethod('patch')) {
            $rules['nom'] = 'required|string|max:255';
        }

        return $rules;
    }

    /**
     * Get custom messages for validator errors.
     *
     * @return array
     */
    public function messages(): array
    {
        return [
            'nom.required' => 'Le nom du produit est requis',
            'nom.max' => 'Le nom ne doit pas dépasser 255 caractères',
            'description.max' => 'La description ne doit pas dépasser 1000 caractères',
            'prix.required' => 'Le prix est requis',
            'prix.numeric' => 'Le prix doit être un nombre',
            'prix.min' => 'Le prix doit être positif',
            'quantite_stock.required' => 'La quantité en stock est requise',
            'quantite_stock.integer' => 'La quantité doit être un entier',
            'quantite_stock.min' => 'La quantité doit être positive',
            'seuil_alerte.required' => 'Le seuil d\'alerte est requis',
            'seuil_alerte.integer' => 'Le seuil d\'alerte doit être un entier',
            'seuil_alerte.min' => 'Le seuil d\'alerte doit être positif',
            'categorie_id.exists' => 'La catégorie spécifiée n\'existe pas',
            'image.max' => 'L\'URL de l\'image ne doit pas dépasser 500 caractères',
        ];
    }

    /**
     * Handle a failed validation attempt.
     *
     * @param  \Illuminate\Contracts\Validation\Validator  $validator
     * @return void
     *
     * @throws \Illuminate\Http\Exceptions\HttpResponseException
     */
    protected function failedValidation(Validator $validator)
    {
        throw new HttpResponseException(
            response()->json([
                'message' => 'Erreur de validation',
                'errors' => $validator->errors(),
            ], 422)
        );
    }
}
