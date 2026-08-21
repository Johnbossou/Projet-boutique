<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Http\Exceptions\HttpResponseException;

class VenteRequest extends FormRequest
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
        return [
            'client_id' => 'nullable|integer|exists:clients,id',
            'montant_total' => 'required|numeric|min:0',
            'montant_paye' => 'required|numeric|min:0',
            'methode_paiement' => 'required|in:especes,carte,cheque,mobile_money',
            'statut' => 'required|in:en_cours,payee,annulee',
            'lignes' => 'required|array|min:1',
            'lignes.*.produit_id' => 'required|integer|exists:produits,id',
            'lignes.*.quantite' => 'required|integer|min:1',
            'lignes.*.prix_unitaire' => 'required|numeric|min:0',
        ];
    }

    /**
     * Get custom messages for validator errors.
     *
     * @return array
     */
    public function messages(): array
    {
        return [
            'client_id.exists' => 'Le client spécifié n\'existe pas',
            'montant_total.required' => 'Le montant total est requis',
            'montant_total.numeric' => 'Le montant total doit être un nombre',
            'montant_total.min' => 'Le montant total doit être positif',
            'montant_paye.required' => 'Le montant payé est requis',
            'montant_paye.numeric' => 'Le montant payé doit être un nombre',
            'montant_paye.min' => 'Le montant payé doit être positif',
            'methode_paiement.required' => 'La méthode de paiement est requise',
            'methode_paiement.in' => 'La méthode de paiement doit être: especes, carte, cheque ou mobile_money',
            'statut.required' => 'Le statut est requis',
            'statut.in' => 'Le statut doit être: en_cours, payee ou annulee',
            'lignes.required' => 'Les lignes de vente sont requises',
            'lignes.array' => 'Les lignes doivent être un tableau',
            'lignes.min' => 'Il doit y avoir au moins une ligne de vente',
            'lignes.*.produit_id.required' => 'L\'ID du produit est requis pour chaque ligne',
            'lignes.*.produit_id.exists' => 'Le produit spécifié n\'existe pas',
            'lignes.*.quantite.required' => 'La quantité est requise pour chaque ligne',
            'lignes.*.quantite.integer' => 'La quantité doit être un entier',
            'lignes.*.quantite.min' => 'La quantité doit être positive',
            'lignes.*.prix_unitaire.required' => 'Le prix unitaire est requis pour chaque ligne',
            'lignes.*.prix_unitaire.numeric' => 'Le prix unitaire doit être un nombre',
            'lignes.*.prix_unitaire.min' => 'Le prix unitaire doit être positif',
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
