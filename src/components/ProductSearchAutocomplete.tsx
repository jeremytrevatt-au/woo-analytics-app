import React, { useState, useEffect } from 'react';
import { Autocomplete, TextField, CircularProgress } from '@mui/material';
import { productsApi, ProductSearchResult } from '../api/productsApi';

interface Props {
  value: ProductSearchResult | null;
  onChange: (value: ProductSearchResult | null) => void;
  label?: string;
  size?: 'small' | 'medium';
}

export default function ProductSearchAutocomplete({ value, onChange, label = "Search Product", size = 'small' }: Props) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<readonly ProductSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    let active = true;

      if (inputValue.length < 2) {
        setOptions([]);
        return undefined;
      }

    setLoading(true);

    const delayDebounceFn = setTimeout(() => {
      productsApi.search(inputValue).then((results) => {
        if (active) {
          setOptions(results);
          setLoading(false);
        }
      }).catch(err => {
        console.error("Failed to search products", err);
        if (active) {
          setOptions([]);
          setLoading(false);
        }
      });
    }, 500); // 500ms debounce

    return () => {
      active = false;
      clearTimeout(delayDebounceFn);
    };
  }, [inputValue, value]);

  return (
    <Autocomplete
      fullWidth
      id="product-search-autocomplete"
      size={size}
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      isOptionEqualToValue={(option, value) => option.id === value.id}
      getOptionLabel={(option) => `${option.sku ? `[${option.sku}] ` : ''}${option.name}`}
      options={options}
      loading={loading}
      value={value}
      onChange={(event: any, newValue: ProductSearchResult | null) => {
        onChange(newValue);
        // Clear input after selection
        setInputValue('');
      }}
      inputValue={inputValue}
      onInputChange={(event, newInputValue) => {
        setInputValue(newInputValue);
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <React.Fragment>
                {loading ? <CircularProgress color="inherit" size={20} /> : null}
                {params.InputProps.endAdornment}
              </React.Fragment>
            ),
          }}
        />
      )}
    />
  );
}
