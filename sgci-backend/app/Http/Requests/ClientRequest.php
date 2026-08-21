<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Http\Exceptions\HttpResponseException;

class ClientRequest extends FormRequest
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
            'nom' => 'required|string|max:255',
            'email' => 'nullable|email|max:255',
            'telephone' => 'nullable|string|max:20',
            'adresse' => 'nullable|string|max:500',
            'ville' => 'nullable|string|max:255',
            'pays' => 'nullable|string|max:255',
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
            'nom.required' => 'Le nom du client est requis',
            'nom.max' => 'Le nom ne doit pas dépasser 255 caractères',
            'email.email' => 'L\'email doit être valide',
            'email.max' => 'L\'email ne doit pas dépasser 255 caractères',
            'telephone.max' => 'Le téléphone ne doit pas dépasser 20 caractères',
            'adresse.max' => 'L\'adresse ne doit pas dépasser 500 caractères',
            'ville.max' => 'La ville ne doit pas dépasser 255 caractères',
            'pays.max' => 'Le pays ne doit pas dépasser 255 caractères',
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
